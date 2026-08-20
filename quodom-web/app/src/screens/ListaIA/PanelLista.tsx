import { useState } from 'react';
import { ApiError } from '../../api/client';
import { listaApi, type ListaEntrada, type ListaResponse } from '../../api/lista';
import { useAuth } from '../../auth/AuthContext';
import { AvisoLogin } from '../../components/AvisoLogin';
import { CargarLista } from './CargarLista';
import { GrupoRubro } from './GrupoRubro';
import { LineasAmbiguas } from './LineasAmbiguas';
import { NoEncontrados } from './NoEncontrados';
import type { ListaAmbigua, ListaCandidato, ListaGrupo, ListaItem } from '../../api/lista';
import './ListaIA.css';

export function PanelLista() {
  const { user } = useAuth();
  const [necesitaLogin, setNecesitaLogin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ListaResponse | null>(null);
  const [resueltas, setResueltas] = useState<Record<string, ListaCandidato | null>>({});
  // Cambia en cada carga para que los GrupoRubro de una carga nueva sean instancias
  // nuevas: si no, un rubro y un idproducto repetidos entre dos cargas heredan el
  // "ya agregado" y el "Agregado ✓" de la carga anterior.
  const [cargaId, setCargaId] = useState(0);

  async function procesar(entrada: ListaEntrada) {
    if (!user) { setNecesitaLogin(true); return; }
    setBusy(true);
    setError(null);
    setResultado(null);
    setResueltas({});
    setCargaId(id => id + 1);
    try {
      setResultado(await listaApi.procesar(entrada));
    } catch (e) {
      setError(e instanceof ApiError || e instanceof Error ? e.message : 'Hubo un problema. Probá de nuevo.');
    } finally {
      setBusy(false);
    }
  }

  function elegir(linea: ListaAmbigua, candidato: ListaCandidato) {
    setResueltas(r => ({ ...r, [linea.textoOriginal]: candidato }));
  }

  function descartar(linea: ListaAmbigua) {
    setResueltas(r => ({ ...r, [linea.textoOriginal]: null }));
  }

  // Los grupos que se dibujan son los que trajo el servidor más lo que el
  // usuario fue resolviendo: elegir un candidato agrega su producto al grupo de
  // su rubro, creándolo si ese rubro todavía no tenía uno.
  const ambiguas = resultado?.ambiguas ?? [];
  const ambiguasPendientes = ambiguas.filter(a => !(a.textoOriginal in resueltas));

  const grupos: ListaGrupo[] = (resultado?.grupos ?? []).map(g => ({ ...g, items: [...g.items] }));

  for (const ambigua of ambiguas) {
    const elegido = resueltas[ambigua.textoOriginal];
    if (!elegido) continue;
    const item: ListaItem = {
      textoOriginal: ambigua.textoOriginal,
      idproducto: elegido.idproducto,
      nombreProducto: elegido.nombreProducto,
      cantidad: ambigua.cantidad
    };
    const grupo = grupos.find(g => g.idrubro === elegido.idrubro);
    if (grupo) {
      // Mismo criterio que el servidor: dos renglones que resuelven al mismo
      // producto del mismo rubro se fusionan en un ítem en vez de duplicar la
      // key en el grupo y perder cantidad en el guardia de "ya agregado".
      const existente = grupo.items.find(it => it.idproducto === item.idproducto);
      if (existente) {
        existente.cantidad += item.cantidad;
        existente.textoOriginal += '; ' + item.textoOriginal;
      } else {
        grupo.items.push(item);
      }
    } else {
      grupos.push({ idrubro: elegido.idrubro, rubro: elegido.rubro, items: [item] });
    }
  }

  // Se calcula sobre lo que realmente se dibuja —los grupos ya fusionados y las
  // ambiguas que siguen sin resolver— y no sobre la respuesta original: si el
  // usuario descarta todas las ambiguas de una lista que no tenía nada más, la
  // pantalla debe avisar que quedó vacía en vez de no mostrar nada.
  const vacio = !!resultado
    && grupos.length === 0
    && ambiguasPendientes.length === 0
    && resultado.noEncontrados.length === 0;

  return (
    <section className="lia" aria-label="Subí tu lista">
      <CargarLista onEnviar={procesar} ocupado={busy} />

      {necesitaLogin && <AvisoLogin />}

      {busy && <p className="lia-cargando">Buscando en el catálogo…</p>}
      {error && <p className="lia-error" role="alert">{error}</p>}

      {resultado && resultado.lineasIgnoradas > 0 && (
        <p className="lia-aviso">
          La lista era muy larga: procesé las primeras y quedaron {resultado.lineasIgnoradas} líneas
          afuera. Subí el resto en una segunda carga.
        </p>
      )}

      {vacio && (
        <p className="lia-error" role="alert">
          No encontré nada del catálogo en esa lista. Si subiste una foto, probá con una más
          nítida, o pegá la lista como texto.
        </p>
      )}

      {resultado && (
        <LineasAmbiguas lineas={ambiguasPendientes} onElegir={elegir} onDescartar={descartar} />
      )}

      {resultado && grupos.map(g => (
        <GrupoRubro key={cargaId + '-' + g.idrubro} grupo={g} pendientesSinResolver={ambiguasPendientes.length} />
      ))}
      {resultado && <NoEncontrados items={resultado.noEncontrados} />}
    </section>
  );
}
