import { useState } from 'react';
import { ApiError } from '../../api/client';
import { listaApi, type ListaEntrada, type ListaResponse } from '../../api/lista';
import { useAuth } from '../../auth/AuthContext';
import { AvisoLogin } from '../../components/AvisoLogin';
import { CargarLista } from './CargarLista';
import { GrupoRubro } from './GrupoRubro';
import { NoEncontrados } from './NoEncontrados';
import './ListaIA.css';

export function PanelLista() {
  const { user } = useAuth();
  const [necesitaLogin, setNecesitaLogin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ListaResponse | null>(null);

  async function procesar(entrada: ListaEntrada) {
    if (!user) { setNecesitaLogin(true); return; }
    setBusy(true);
    setError(null);
    setResultado(null);
    try {
      setResultado(await listaApi.procesar(entrada));
    } catch (e) {
      setError(e instanceof ApiError || e instanceof Error ? e.message : 'Hubo un problema. Probá de nuevo.');
    } finally {
      setBusy(false);
    }
  }

  const vacio = resultado && resultado.grupos.length === 0 && resultado.noEncontrados.length === 0;

  return (
    <section className="lia">
      <h2 className="lia-titulo">Subí tu lista</h2>
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

      {resultado?.grupos.map(g => <GrupoRubro key={g.idrubro} grupo={g} />)}
      {resultado && <NoEncontrados items={resultado.noEncontrados} />}
    </section>
  );
}
