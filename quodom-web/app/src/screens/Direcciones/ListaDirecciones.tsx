import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { users } from '../../api/users';
import { userDirecciones } from '../../api/user_direcciones';
import type { Direccion } from '../../api/types';
import { ApiError } from '../../api/client';
import { Loader } from '../../components/Loader';
import { ErrorState } from '../../components/ErrorState';
import { EmptyState } from '../../components/EmptyState';
import './ListaDirecciones.css';

export function ListaDirecciones() {
  const [list, setList] = useState<Direccion[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    let alive = true;
    setList(null); setErr(null);
    users.getDirecciones()
      .then(d => { if (alive) setList(d); })
      .catch(e => { if (alive) setErr(e instanceof ApiError ? e.message : 'Error.'); });
    return () => { alive = false; };
  }, [nonce]);

  async function marcarDefault(id: number) {
    try { await userDirecciones.setPrincipal(id); setNonce(n => n + 1); }
    catch (e) { setErr(e instanceof ApiError ? e.message : 'Error.'); }
  }
  async function eliminar(id: number) {
    if (!confirm('¿Eliminar esta dirección?')) return;
    try { await userDirecciones.eliminar(id); setNonce(n => n + 1); }
    catch (e) { setErr(e instanceof ApiError ? e.message : 'Error.'); }
  }

  return (
    <section className="container dirs">
      <div className="dirs-header">
        <h1>Direcciones</h1>
        {/* Sin direcciones, el EmptyState de abajo ya ofrece "Agregar dirección"
            y los dos botones quedaban uno encima del otro. */}
        {list && list.length > 0 && <Link to="/direcciones/nuevo" className="btn">Agregar</Link>}
      </div>
      {err && <ErrorState message={err} onRetry={() => setNonce(n => n + 1)} />}
      {!err && !list && <Loader />}
      {list && list.length === 0 && (
        <EmptyState title="No tenés direcciones cargadas" description="Cargá una para incluirla en el mensaje de WhatsApp." action={<Link to="/direcciones/nuevo" className="btn">Agregar dirección</Link>} />
      )}
      {list && list.length > 0 && (
        <ul className="dirs-list">
          {list.map(d => (
            <li key={d.id} className="dirs-item card hoja">
              <div className="dirs-info">
                <div className="dirs-alias">{d.alias || d.calle}</div>
                <div className="dirs-line">{d.calle} {d.numero}{d.piso ? ' · ' + d.piso : ''}</div>
                <div className="dirs-line dirs-muted">{d.localidad}, {d.provincia} {d.cp && '(' + d.cp + ')'}</div>
              </div>
              <div className="dirs-actions">
                {(d.default ? true : false)
                  ? <span className="dirs-badge">Principal</span>
                  : <button className="btn btn-ghost" onClick={() => marcarDefault(d.id)}>Hacer principal</button>}
                <Link to={'/direcciones/' + d.id} className="btn btn-ghost">Editar</Link>
                <button className="btn btn-ghost" onClick={() => eliminar(d.id)}>Eliminar</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
