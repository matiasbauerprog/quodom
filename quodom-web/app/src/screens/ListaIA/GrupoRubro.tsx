import { useState, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ESTADO_VENTANA, hrefVentana } from '../../quodom/ventanaQuodom';
import { PropuestaEditable } from '../ModoIA/PropuestaEditable';
import { DialogoDestino } from '../../quodom/DialogoDestino';
import { useDestinoLote } from '../../quodom/useDestinoLote';
import { nombreRubro } from '../../quodom/rubros';
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

export function GrupoRubro({
  grupo,
  pendientesSinResolver = 0
}: {
  grupo: ListaGrupo;
  pendientesSinResolver?: number;
}) {
  const location = useLocation();
  const [confirming, setConfirming] = useState(false);
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

  // Recordamos qué idproducto ya se agregó al servidor para que un reintento
  // tras un error parcial no vuelva a agregar las líneas que sí se guardaron.
  const agregadosRef = useRef<Set<number>>(new Set());

  // Lo que todavía no se mandó al servidor. Un grupo ya confirmado puede recibir
  // productos nuevos si el usuario resuelve una línea ambigua de este rubro
  // después de haber confirmado.
  const pendientes = items.filter(it => !agregadosRef.current.has(it.idproducto));
  const todoAgregado = agregadoEn !== null && pendientes.length === 0;

  async function agregarLinea(idquodom: string, it: IaProposalItem) {
    if (agregadosRef.current.has(it.idproducto)) return;
    await quodomLines.add({
      idquodom,
      idproducto: it.idproducto,
      cantidad: it.cantidad,
      nombreProducto: it.nombreProducto
    });
    agregadosRef.current.add(it.idproducto);
  }

  function mensajeDeError(e: unknown) {
    return e instanceof ApiError || e instanceof Error ? e.message : 'No se pudo agregar al Quodom.';
  }

  const lote = useDestinoLote<IaProposalItem>({ agregarItem: agregarLinea, descripcion: descripcionLista });

  // Va al Quodom abierto del rubro; sin ninguno abierto pregunta a cuál sumarlo
  // (o si crear uno nuevo) en vez de crear como efecto secundario.
  async function confirmar(elegidos: IaProposalItem[]) {
    setConfirming(true);
    setError(null);
    try {
      const id = await lote.resolver(grupo.idrubro, elegidos);
      if (id) setAgregadoEn(id);
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setConfirming(false);
    }
  }

  // Un grupo ya confirmado sólo cuenta lo que todavía está sin mandar: si no,
  // un producto tardío hace que el título siga contando lo ya agregado.
  const cantidadTitulo = agregadoEn !== null ? pendientes.length : grupo.items.length;
  const titulo = (grupo.rubro || nombreRubro(grupo.idrubro))
    + ' — ' + cantidadTitulo + (cantidadTitulo === 1 ? ' producto' : ' productos');

  return (
    <section className="gr card hoja">
      <h2 className="gr-titulo">{titulo}</h2>

      {agregadoEn && (
        <p className="gr-agregado">
          Agregado ✓ <Link to={hrefVentana(location, agregadoEn)} state={ESTADO_VENTANA}>ver Quodom</Link>
        </p>
      )}

      {!todoAgregado && (
        <>
          {/* Una key derivada de lo pendiente fuerza una instancia nueva cuando la
              lista cambia: PropuestaEditable copia items a su propio estado al montar
              y no se resincroniza con la prop, así que sin esto un producto que llega
              a un grupo ya existente y sin confirmar nunca se dibuja. La cantidad va
              en la key además del idproducto: un candidato que resuelve al mismo
              producto ya pendiente en el grupo no cambia el conjunto de ids, sólo
              suma cantidad, y sin esto PropuestaEditable se queda con su copia vieja
              y manda la cantidad de antes de la fusión. */}
          <PropuestaEditable
            key={pendientes.map(p => p.idproducto + 'x' + p.cantidad).join('-')}
            items={pendientes}
            onConfirm={confirmar}
            busy={confirming}
          />

          {pendientesSinResolver > 0 && (
            <p className="gr-pendientes">
              Quedan {pendientesSinResolver}{' '}
              {pendientesSinResolver === 1 ? 'línea' : 'líneas'} sin resolver arriba.
            </p>
          )}
        </>
      )}

      {error && <p className="gr-error" role="alert">{error}</p>}

      {lote.destino && (
        <DialogoDestino
          nombreRubro={grupo.rubro || nombreRubro(grupo.idrubro)}
          candidatos={lote.destino.candidatos}
          onElegir={async idquodom => { const id = await lote.elegir(idquodom); if (id) setAgregadoEn(id); }}
          onCrear={async () => { const id = await lote.crear(); if (id) setAgregadoEn(id); }}
          onCancelar={lote.cancelar}
          ocupado={lote.ocupado}
          error={lote.error}
        />
      )}
    </section>
  );
}
