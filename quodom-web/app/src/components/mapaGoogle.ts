/**
 * Carga el SDK de Google Maps en el navegador, una sola vez.
 *
 * **Es la única parte del proyecto donde una clave de Google vive en el
 * navegador**, y por eso es una clave distinta de la del servidor:
 * `VITE_GOOGLE_MAPS_BROWSER_KEY` tiene que estar restringida por *HTTP
 * referrer* al dominio de la app en la consola de Google. La del servidor no se
 * puede reusar — en el bundle se lee, y una clave sin restricción de dominio la
 * puede gastar cualquiera.
 *
 * El resto de las llamadas a Google siguen saliendo del servidor (§9 de
 * `claude.md`). Esto es la excepción, y existe porque un mapa arrastrable no se
 * puede dibujar desde el backend.
 *
 * Cada carga del mapa se le paga a Google, así que el SDK se inyecta una vez
 * por sesión del navegador y la promesa se reusa: abrir y cerrar la ventana
 * cinco veces no son cinco cargas.
 */

type Listener = { remove: () => void };

export type MapaGoogle = {
  setCenter: (p: { lat: number; lng: number }) => void;
  getCenter: () => { lat: () => number; lng: () => number };
  addListener: (evento: string, fn: (e: { latLng?: { lat: () => number; lng: () => number } }) => void) => Listener;
};

export type MarcadorGoogle = {
  setPosition: (p: { lat: number; lng: number }) => void;
  getPosition: () => { lat: () => number; lng: () => number } | null;
  addListener: (evento: string, fn: () => void) => Listener;
  setMap: (m: MapaGoogle | null) => void;
};

type MapsApi = {
  Map: new (el: HTMLElement, opts: Record<string, unknown>) => MapaGoogle;
  Marker: new (opts: Record<string, unknown>) => MarcadorGoogle;
};

declare global {
  interface Window {
    google?: { maps?: MapsApi };
    __quodomMapaListo?: () => void;
  }
}

const CALLBACK = '__quodomMapaListo';
let pendiente: Promise<MapsApi> | null = null;

export class SinClaveDeMapa extends Error {
  constructor() {
    super('Falta VITE_GOOGLE_MAPS_BROWSER_KEY. Es una clave aparte de la del servidor, restringida por dominio.');
    this.name = 'SinClaveDeMapa';
  }
}

export function cargarMapa(): Promise<MapsApi> {
  if (window.google && window.google.maps) return Promise.resolve(window.google.maps);
  if (pendiente) return pendiente;

  const clave = import.meta.env.VITE_GOOGLE_MAPS_BROWSER_KEY as string | undefined;
  if (!clave) return Promise.reject(new SinClaveDeMapa());

  pendiente = new Promise<MapsApi>((resolver, rechazar) => {
    window[CALLBACK] = () => {
      const maps = window.google && window.google.maps;
      if (maps) resolver(maps);
      else rechazar(new Error('El mapa cargó sin la librería esperada.'));
    };

    const s = document.createElement('script');
    s.src = 'https://maps.googleapis.com/maps/api/js'
      + '?key=' + encodeURIComponent(clave)
      + '&callback=' + CALLBACK
      + '&language=es&region=AR'
      + '&loading=async';
    s.async = true;
    // Si el script no carga —red caída, clave rechazada, bloqueador— hay que
    // soltar la promesa: dejarla pendiente deja la ventana con el esqueleto
    // para siempre y sin forma de reintentar.
    s.onerror = () => {
      pendiente = null;
      rechazar(new Error('No se pudo cargar el mapa.'));
    };
    document.head.appendChild(s);
  });

  return pendiente;
}
