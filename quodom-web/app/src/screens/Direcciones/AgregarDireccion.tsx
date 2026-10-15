import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { provincias } from '../../api/provincias';
import { localidades } from '../../api/localidades';
import { userDirecciones, DireccionInput } from '../../api/user_direcciones';
import type { Provincia, Localidad } from '../../api/types';
import { ApiError } from '../../api/client';
import { AppBarBack } from '../../components/layout/AppBarBack';
import { CampoDireccionMapa } from '../../components/CampoDireccionMapa';
import type { DireccionDeLugar } from '../../api/types';
import './AgregarDireccion.css';

export function AgregarDireccion() {
  const navigate = useNavigate();
  const [provs, setProvs] = useState<Provincia[]>([]);
  const [locs, setLocs] = useState<Localidad[]>([]);
  const [f, setF] = useState<DireccionInput>({ default: false });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { provincias.list().then(setProvs).catch(() => {}); }, []);
  useEffect(() => {
    if (!f.idprovincia) { setLocs([]); return; }
    localidades.porProvincia(f.idprovincia).then(setLocs).catch(() => setLocs([]));
  }, [f.idprovincia]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setBusy(true);
    try {
      await userDirecciones.create(f);
      // El sidebar vive en el Layout y no se desmonta al cambiar de pantalla:
      // sin este aviso seguiría bloqueando el envío por falta de dirección.
      window.dispatchEvent(new Event('direcciones:changed'));
      navigate('/direcciones', { replace: true });
    } catch (e) { setErr(e instanceof ApiError ? e.message : 'No se pudo guardar.'); }
    finally { setBusy(false); }
  }
  const set = <K extends keyof DireccionInput>(k: K) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const raw = e.target.value;
    const v: DireccionInput[K] = (k === 'idprovincia') ? (raw ? Number(raw) : undefined) as any : (raw as any);
    const borraElMapa = CAMPOS_DE_UBICACION.includes(k);
    setF(prev => ({
      ...prev,
      [k]: v,
      ...(borraElMapa ? { placeid: null, lat: null, lng: null } : {})
    }));
  };

  // Los campos que definen DÓNDE queda la dirección. Si el usuario edita uno a
  // mano, las coordenadas que trajo el mapa dejan de describir esa dirección,
  // así que se borran: quedarse con ellas produce una fila cuyo texto dice una
  // cosa y cuyo punto está en otra, y eso más adelante no se ve como un error
  // — se ve como una lista de proveedores perfectamente ordenada alrededor del
  // lugar equivocado. Alias, piso y observaciones no mueven nada, así que no
  // invalidan nada.
  const CAMPOS_DE_UBICACION: (keyof DireccionInput)[] = ['calle', 'numero', 'localidad', 'cp', 'idprovincia'];

  // Los campos quedan editables después de aplicarlos. Google no siempre trae
  // la altura (una esquina, un lugar con nombre) y el piso nunca lo trae, así
  // que el formulario sigue siendo el que manda: el mapa lo rellena, no lo
  // reemplaza. Y sin clave de Google el buscador no anda: cargar a mano es el
  // único camino que queda.
  function aplicarDelMapa(d: DireccionDeLugar) {
    setF(prev => ({
      ...prev,
      calle: d.calle,
      numero: d.numero,
      localidad: d.localidad,
      cp: d.cp,
      direccion: d.direccion,
      idprovincia: d.idprovincia ?? undefined,
      placeid: d.placeid,
      lat: d.lat,
      lng: d.lng
    }));
  }

  return (
    <>
      <AppBarBack title="Nueva dirección" />
      <section className="container dir-form">
        <form onSubmit={onSubmit}>
          <CampoDireccionMapa onElegir={aplicarDelMapa} />
          <label className="field"><span>Alias (ej: casa, obra)</span><input className="input" value={f.alias ?? ''} onChange={set('alias')} /></label>
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
            <datalist id="locs">
              {locs.map(l => <option key={l.id} value={l.nombre ?? ''} />)}
            </datalist>
          </label>
          <label className="field"><span>CP</span><input className="input" value={f.cp ?? ''} onChange={set('cp')} /></label>
          <label className="field"><span>Observaciones</span><input className="input" value={f.observaciones ?? ''} onChange={set('observaciones')} /></label>
          <label className="check"><input type="checkbox" checked={!!f.default} onChange={e => setF({ ...f, default: e.target.checked })} /> Usar como dirección principal</label>
          {err && <p className="auth-error">{err}</p>}
          <button className="btn btn-block" disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</button>
        </form>
      </section>
    </>
  );
}
