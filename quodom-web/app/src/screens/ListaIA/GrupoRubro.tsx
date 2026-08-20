import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PropuestaEditable } from '../ModoIA/PropuestaEditable';
import { DialogoNuevoRubro } from '../../quodom/DialogoNuevoRubro';
import { nombreRubro } from '../../quodom/rubros';
import { quodom as quodomApi } from '../../api/quodom';
import { quodomLines } from '../../api/quodom_lines';
import { ApiError } from '../../api/client';
import type { ListaGrupo } from '../../api/lista';
import type { IaProposalItem } from '../../api/ia';

function descripcionLista() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return 'Lista IA — ' + now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate())
    + ' ' + pad(now.getHours()) + ':' + pad(now.getMinutes());
}

export function GrupoRubro({ grupo }: { grupo: ListaGrupo }) {
  const [confirming, setConfirming] = useState(false);
  const [pendiente, setPendiente] = useState<IaProposalItem[] | null>(null);
  const [agregadoEn, setAgregadoEn] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // PropuestaEditable habla en IaProposalItem. El renglón original de la lista
  // viaja en `motivo`: queda debajo del nombre y el usuario puede verificar el
  // match sin tocar el componente que comparte con el Modo IA.
  const items: IaProposalItem[] = grupo.items.map(it => ({
    idproducto: it.idproducto,
    cantidad: it.cantidad,
    nombreProducto: it.nombreProducto,
    motivo: 'De tu lista: ' + it.textoOriginal
  }));

  async function agregarLineas(idquodom: string, elegidos: IaProposalItem[]) {
    for (const it of elegidos) {
      await quodomLines.add({
        idquodom,
        idproducto: it.idproducto,
        cantidad: it.cantidad,
        nombreProducto: it.nombreProducto
      });
    }
    window.dispatchEvent(new Event('quodom:changed'));
    setAgregadoEn(idquodom);
  }

  function mensajeDeError(e: unknown) {
    return e instanceof ApiError || e instanceof Error ? e.message : 'No se pudo agregar al Quodom.';
  }

  async function confirmar(elegidos: IaProposalItem[]) {
    setConfirming(true);
    setError(null);
    try {
      const activo = await quodomApi.activoPorRubro(grupo.idrubro);
      if (!activo) {
        // Nunca se crea un Quodom como efecto secundario: primero se pregunta.
        setPendiente(elegidos);
        return;
      }
      await agregarLineas(activo.id, elegidos);
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setConfirming(false);
    }
  }

  async function crearYConfirmar() {
    if (!pendiente) return;
    setConfirming(true);
    try {
      const creado = await quodomApi.create({ descripcion: descripcionLista(), idrubro: grupo.idrubro });
      await agregarLineas(creado.idquodom, pendiente);
      setPendiente(null);
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setConfirming(false);
    }
  }

  const titulo = (grupo.rubro || nombreRubro(grupo.idrubro))
    + ' — ' + grupo.items.length + (grupo.items.length === 1 ? ' producto' : ' productos');

  return (
    <section className="gr card hoja">
      <h2 className="gr-titulo">{titulo}</h2>

      {agregadoEn
        ? (
          <p className="gr-agregado">
            Agregado ✓ <Link to={'/quodom?id=' + encodeURIComponent(agregadoEn)}>ver Quodom</Link>
          </p>
        )
        : <PropuestaEditable items={items} onConfirm={confirmar} busy={confirming} />}

      {error && <p className="gr-error" role="alert">{error}</p>}

      {pendiente && (
        <DialogoNuevoRubro
          nombreRubro={grupo.rubro || nombreRubro(grupo.idrubro)}
          onConfirmar={crearYConfirmar}
          onCancelar={() => setPendiente(null)}
          ocupado={confirming}
        />
      )}
    </section>
  );
}
