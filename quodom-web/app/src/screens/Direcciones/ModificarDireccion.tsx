import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { provincias } from '../../api/provincias';
import { localidades } from '../../api/localidades';
import { userDirecciones, DireccionInput } from '../../api/user_direcciones';
import type { Provincia, Localidad } from '../../api/types';
import { ApiError } from '../../api/client';
import { AppBarBack } from '../../components/layout/AppBarBack';
import { Loader } from '../../components/Loader';
import { CampoDireccionMapa } from '../../components/CampoDireccionMapa';
import { DialogoMapa } from '../../components/DialogoMapa';
import type { DireccionDeLugar } from '../../api/types';
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
  const [mapaAbierto, setMapaAbierto] = useState(false);

  useEffect(() => {
    Promise.all([provincias.list(), userDirecciones.porId(idNum)])
      .then(([ps, d]) => {
        setProvs(ps);
        setF({
          alias: d.alias ?? '', calle: d.calle ?? '', numero: d.numero ?? '', piso: d.piso ?? '',
          cp: d.cp ?? '', localidad: d.localidad ?? '', observaciones: d.observaciones ?? '',
          idprovincia: d.idprovincia ? Number(d.idprovincia) : undefined,
          // Sin esto el link al mapa nunca aparece en una direccion ya
          // guardada, y el PUT viaja sin los datos del mapa: Object.assign
          // deja los de la base y el formulario miente sobre lo que guarda.
          placeid: d.placeid ?? undefined,
          lat: d.lat ?? undefined,
          lng: d.lng ?? undefined,
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
    const borraElMapa = CAMPOS_DE_UBICACION.includes(k);
    setF(prev => prev ? ({
      ...prev,
      [k]: v,
      ...(borraElMapa ? { placeid: null, lat: null, lng: null, punto_manual: null } : {})
    }) : prev);
  };

  // Los campos que ubican el punto DENTRO del pueblo. Si el usuario edita uno a
  // mano, las coordenadas que trajo el mapa dejan de describir esa dirección,
  // así que se borran: quedarse con ellas produce una fila cuyo texto dice una
  // cosa y cuyo punto está en otra, y eso más adelante no se ve como un error
  // — se ve como una lista de proveedores perfectamente ordenada alrededor del
  // lugar equivocado. Alias, piso y observaciones no mueven nada, así que no
  // invalidan nada.
  //
  // Localidad, CP y provincia NO están acá, y eso se midió con un usuario real
  // el 2026-10-15: eligió su casa del mapa y corrigió la localidad, porque
  // Google devuelve el partido ("San Martín") donde el usuario dice el pueblo
  // ("Villa Ballester"). Con esos campos en la lista, corregir un NOMBRE le
  // borraba el punto, en silencio — el mismo mal que esta regla venía a evitar.
  // Corregir cómo se llama el lugar no es mudarse.
  const CAMPOS_DE_UBICACION: (keyof DireccionInput)[] = ['calle', 'numero'];

  // Igual que en Nueva dirección: el mapa rellena los campos y los deja
  // editables. Acá el estado puede ser null mientras carga, así que se
  // actualiza sólo si ya hay formulario.
  function aplicarDelMapa(d: DireccionDeLugar) {
    setF(prev => prev ? ({
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
    }) : prev);
  }

  // Lo que vuelve del pin arrastrable. Dos diferencias con el autocompletado,
  // y las dos importan:
  //
  // - `punto_manual: true`. Sin esa marca, `puntoDelQuodom` deduce la precisión
  //   del `placeid` y una dirección sin él queda como imprecisa: el usuario
  //   pondría el pin en su casa y la pantalla le seguiría diciendo "tu
  //   dirección no está ubicada con precisión".
  // - **No se toca el `placeid`.** El que devuelve la inversa es el de la
  //   dirección más cercana que Google conoce, no el del punto elegido, y
  //   guardarlo le daría dos fuentes al mismo punto.
  //
  // Los campos de texto se rellenan sólo si vienen con algo: quien movió el pin
  // para corregir un punto ya tiene la calle escrita, y pisársela con '' sería
  // borrarle lo que estaba bien.
  function aplicarDelPin(d: DireccionDeLugar) {
    setMapaAbierto(false);
    setF(prev => prev ? ({
      ...prev,
      calle: d.calle || prev.calle,
      numero: d.numero || prev.numero,
      localidad: d.localidad || prev.localidad,
      cp: d.cp || prev.cp,
      direccion: d.direccion || prev.direccion,
      idprovincia: d.idprovincia ?? prev.idprovincia,
      lat: d.lat,
      lng: d.lng,
      punto_manual: true
    }) : prev);
  }

  return (
    <>
      <AppBarBack title="Editar dirección" />
      <section className="container dir-form">
        {!f && !err && <Loader />}
        {err && <p className="auth-error">{err}</p>}
        {f && (
          <form onSubmit={onSubmit}>
            <label className="field"><span>Alias</span><input className="input" value={f.alias ?? ''} onChange={set('alias')} /></label>
            <CampoDireccionMapa onElegir={aplicarDelMapa} />
            <div className="dir-mapa-acciones">
            {/* Mirar el punto no alcanza: una geocodificación equivocada no da
                error, da una dirección que se ve perfecta y un punto en otro
                lado. Acá se arregla donde se ve, y por eso el link que sólo
                abría Google Maps en otra pestaña ya no está: era la mitad
                inútil de la misma acción. */}
            <button type="button" className="btn btn-ghost dir-mapa-ajustar" onClick={() => setMapaAbierto(true)}>
              {f.lat != null && f.lng != null ? 'Ajustar en el mapa' : 'Marcar en el mapa'}
            </button>
          </div>
          {mapaAbierto && (
            <DialogoMapa
              lat={f.lat}
              lng={f.lng}
              onElegir={aplicarDelPin}
              onCerrar={() => setMapaAbierto(false)}
            />
          )}
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
              <datalist id="locs">{locs.map(l => <option key={l.id} value={l.nombre ?? ''} />)}</datalist>
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
