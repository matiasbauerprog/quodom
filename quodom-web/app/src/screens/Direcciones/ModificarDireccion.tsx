import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { provincias } from '../../api/provincias';
import { localidades } from '../../api/localidades';
import { userDirecciones, DireccionInput } from '../../api/user_direcciones';
import type { Provincia, Localidad } from '../../api/types';
import { ApiError } from '../../api/client';
import { AppBarBack } from '../../components/layout/AppBarBack';
import { Loader } from '../../components/Loader';
import './AgregarDireccion.css';

export function ModificarDireccion() {
  const { id = '' } = useParams();
  const idNum = Number(id);
  const navigate = useNavigate();
  const [provs, setProvs] = useState<Provincia[]>([]);
  const [locs, setLocs] = useState<Localidad[]>([]);
  const [f, setF] = useState<DireccionInput | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([provincias.list(), userDirecciones.porId(idNum)])
      .then(([ps, d]) => {
        setProvs(ps);
        setF({
          alias: d.alias ?? '', calle: d.calle ?? '', numero: d.numero ?? '', piso: d.piso ?? '',
          cp: d.cp ?? '', localidad: d.localidad ?? '', observaciones: d.observaciones ?? '',
          idprovincia: d.idprovincia ? Number(d.idprovincia) : undefined,
          default: !!d.default
        });
      })
      .catch(e => setErr(e instanceof ApiError ? e.message : 'Error.'));
  }, [idNum]);

  useEffect(() => {
    if (!f?.idprovincia) { setLocs([]); return; }
    localidades.porProvincia(f.idprovincia).then(setLocs).catch(() => setLocs([]));
  }, [f?.idprovincia]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!f) return;
    setErr(null); setBusy(true);
    try { await userDirecciones.update(idNum, f); navigate('/direcciones', { replace: true }); }
    catch (e) { setErr(e instanceof ApiError ? e.message : 'No se pudo guardar.'); }
    finally { setBusy(false); }
  }
  const set = <K extends keyof DireccionInput>(k: K) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (!f) return;
    const raw = e.target.value;
    const v: DireccionInput[K] = (k === 'idprovincia') ? (raw ? Number(raw) : undefined) as any : (raw as any);
    setF({ ...f, [k]: v });
  };

  return (
    <>
      <AppBarBack title="Editar dirección" />
      <section className="container dir-form">
        {!f && !err && <Loader />}
        {err && <p className="auth-error">{err}</p>}
        {f && (
          <form onSubmit={onSubmit}>
            <label className="field"><span>Alias</span><input className="input" value={f.alias ?? ''} onChange={set('alias')} /></label>
            <div className="grid-2">
              <label className="field"><span>Calle</span><input className="input" value={f.calle ?? ''} onChange={set('calle')} required /></label>
              <label className="field"><span>Número</span><input className="input" value={f.numero ?? ''} onChange={set('numero')} required /></label>
            </div>
            <label className="field"><span>Piso / Depto</span><input className="input" value={f.piso ?? ''} onChange={set('piso')} /></label>
            <label className="field"><span>Provincia</span>
              <select className="input" value={f.idprovincia ?? ''} onChange={set('idprovincia')} required>
                <option value="">Elegí provincia</option>
                {provs.map(p => <option key={p.id} value={p.id}>{p.provincia}</option>)}
              </select>
            </label>
            <label className="field"><span>Localidad</span>
              <input list="locs" className="input" value={f.localidad ?? ''} onChange={set('localidad')} required />
              <datalist id="locs">{locs.map(l => <option key={l.id} value={l.localidad} />)}</datalist>
            </label>
            <label className="field"><span>CP</span><input className="input" value={f.cp ?? ''} onChange={set('cp')} /></label>
            <label className="field"><span>Observaciones</span><input className="input" value={f.observaciones ?? ''} onChange={set('observaciones')} /></label>
            <label className="check"><input type="checkbox" checked={!!f.default} onChange={e => setF({ ...f, default: e.target.checked })} /> Usar como dirección principal</label>
            <button className="btn btn-block" disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</button>
          </form>
        )}
      </section>
    </>
  );
}
