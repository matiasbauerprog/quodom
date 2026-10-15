import { useEffect, useRef, useState } from 'react';
import { lugares } from '../api/lugares';
import { ApiError } from '../api/client';
import { cargarMapa, SinClaveDeMapa, type MapaGoogle, type MarcadorGoogle } from './mapaGoogle';
import type { DireccionDeLugar } from '../api/types';
import './DialogoMapa.css';

type Props = {
  /** Dónde arranca el pin. Sin punto, el mapa abre sobre el AMBA. */
  lat?: number | null;
  lng?: number | null;
  onElegir: (d: DireccionDeLugar) => void;
  onCerrar: () => void;
};

// El centro por defecto cuando la dirección todavía no tiene punto. El producto
// apunta a centros urbanos y el AMBA es donde está medido; con un zoom bajo, el
// usuario ve dónde está parado y arrastra desde ahí.
const AMBA = { lat: -34.6037, lng: -58.3816 };
const ZOOM_CON_PUNTO = 17;
const ZOOM_SIN_PUNTO = 11;

/**
 * El mapa para poner el pin donde está la dirección de verdad.
 *
 * Existe porque **la única forma de detectar una geocodificación equivocada es
 * mirarla**, y hasta acá mirarla era todo lo que se podía hacer: el link abría
 * Google Maps en otra pestaña, mostrando coordenadas en crudo y sin forma de
 * corregir nada. Ahora el punto se arregla donde se ve.
 *
 * Tres cosas que no son estéticas:
 *
 * - **Cada movimiento del pin que se confirma cuesta una consulta paga**
 *   (geocodificación inversa). Por eso se consulta en `dragend` y en el clic, y
 *   nunca mientras se arrastra, que serían decenas por gesto.
 * - **Lo que se guarda es el punto del pin, no el que Google emparejó.** El
 *   servidor devuelve las coordenadas tal como se piden; la dirección es la
 *   confirmación de que el pin quedó donde el usuario quería.
 * - **La dirección que se muestra es texto y no un dato más del formulario
 *   hasta que el usuario confirma.** Mover el pin y cerrar no cambia nada.
 */
export function DialogoMapa({ lat, lng, onElegir, onCerrar }: Props) {
  const divMapa = useRef<HTMLDivElement | null>(null);
  const marcador = useRef<MarcadorGoogle | null>(null);
  const [errMapa, setErrMapa] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [punto, setPunto] = useState<{ lat: number; lng: number } | null>(
    lat != null && lng != null ? { lat, lng } : null
  );
  const [direccion, setDireccion] = useState<DireccionDeLugar | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [errDir, setErrDir] = useState<string | null>(null);

  // Monta el mapa una vez. El pin arranca en el punto que ya tenga la dirección
  // y, si no tiene, el mapa abre sin pin: poner uno en el centro del AMBA sería
  // afirmar una ubicación que nadie eligió.
  useEffect(() => {
    let vivo = true;
    const listeners: { remove: () => void }[] = [];

    cargarMapa()
      .then(maps => {
        if (!vivo || !divMapa.current) return;
        setCargando(false);

        const inicial = lat != null && lng != null ? { lat, lng } : AMBA;
        const mapa: MapaGoogle = new maps.Map(divMapa.current, {
          center: inicial,
          zoom: lat != null && lng != null ? ZOOM_CON_PUNTO : ZOOM_SIN_PUNTO,
          disableDefaultUI: false,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
          clickableIcons: false
        });

        const m: MarcadorGoogle = new maps.Marker({
          position: inicial,
          map: lat != null && lng != null ? mapa : null,
          draggable: true
        });
        marcador.current = m;

        // Sólo al soltar: durante el arrastre serían decenas de consultas pagas.
        listeners.push(m.addListener('dragend', () => {
          const p = m.getPosition();
          if (p) mover({ lat: p.lat(), lng: p.lng() });
        }));

        // Un clic también mueve el pin: en celular arrastrar un pin de 20px es
        // incómodo, y tocar donde va es el gesto natural.
        listeners.push(mapa.addListener('click', e => {
          if (!e.latLng) return;
          const p = { lat: e.latLng.lat(), lng: e.latLng.lng() };
          m.setPosition(p);
          m.setMap(mapa);
          mover(p);
        }));

        if (lat != null && lng != null) mover({ lat, lng });
      })
      .catch(e => {
        if (!vivo) return;
        setCargando(false);
        setErrMapa(e instanceof SinClaveDeMapa
          ? 'El mapa no está configurado en este entorno. Podés cargar la dirección a mano.'
          : 'No pudimos abrir el mapa. Podés cargar la dirección a mano.');
      });

    return () => {
      vivo = false;
      for (const l of listeners) l.remove();
      marcador.current = null;
    };
    // Se monta una sola vez: `lat`/`lng` son el punto de partida, no una
    // suscripción. Re-montar el mapa en cada cambio perdería el zoom y el
    // encuadre que el usuario acomodó, y pagaría otra carga.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function mover(p: { lat: number; lng: number }) {
    setPunto(p);
    setDireccion(null);
    setErrDir(null);
    setBuscando(true);
    try {
      const d = await lugares.punto(p.lat, p.lng);
      setDireccion(d);
    } catch (e) {
      // Se informa, pero **no bloquea**: el punto que el usuario eligió sirve
      // igual para medir distancias, y es lo que vino a arreglar. Sin dirección
      // se confirma el punto solo.
      setErrDir(e instanceof ApiError ? e.message : 'No pudimos leer la dirección de ese punto.');
    } finally {
      setBuscando(false);
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCerrar]);

  function confirmar() {
    if (!punto) return;
    // Sin dirección legible se confirma igual, con los campos de texto vacíos:
    // quien edita a mano ya los tiene puestos, y el punto es lo que faltaba.
    onElegir(direccion
      ? { ...direccion, lat: punto.lat, lng: punto.lng }
      : { placeid: '', calle: '', numero: '', localidad: '', partido: '', cp: '', direccion: '', lat: punto.lat, lng: punto.lng });
  }

  return (
    <div className="dmapa-backdrop" onClick={onCerrar}>
      <section
        className="dmapa card hoja"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dmapa-titulo"
        onClick={e => e.stopPropagation()}
      >
        <h2 id="dmapa-titulo" className="dmapa-titulo">Ajustá el punto en el mapa</h2>
        <p className="dmapa-ayuda">
          Arrastrá el pin o tocá el mapa donde está la dirección. Es el punto desde el que se miden los proveedores cerca.
        </p>

        {errMapa
          ? <p className="dmapa-err" role="alert">{errMapa}</p>
          : <div className={'dmapa-lienzo' + (cargando ? ' esqueleto' : '')} ref={divMapa} />}

        <div className="dmapa-lectura" aria-live="polite">
          {!punto && !errMapa && <p className="dmapa-nada">Tocá el mapa para poner el pin.</p>}
          {punto && buscando && <p className="dmapa-nada">Buscando la dirección…</p>}
          {punto && !buscando && direccion && (
            <p className="dmapa-direccion">{direccion.direccion || [direccion.calle, direccion.numero].filter(Boolean).join(' ')}</p>
          )}
          {punto && !buscando && errDir && <p className="dmapa-err">{errDir}</p>}
        </div>

        <footer className="dmapa-pie">
          <button type="button" className="btn" disabled={!punto} onClick={confirmar}>
            Usar esta ubicación
          </button>
          <button type="button" className="btn btn-ghost" onClick={onCerrar}>Cancelar</button>
        </footer>
      </section>
    </div>
  );
}
