import { useEffect, useRef, useState } from 'react';
import { lugares } from '../api/lugares';
import type { DireccionDeLugar, SugerenciaLugar } from '../api/types';
import './CampoDireccionMapa.css';

const MINIMO = 3;
const ESPERA_MS = 350;

/**
 * Busca la dirección en el mapa y la entrega desarmada.
 *
 * Dos reglas que son de costo y no de estética: no consulta con menos de 3
 * caracteres, y agrupa el tecleo en una sola consulta cada 350ms. Cada
 * consulta se le paga a Google; sin esto, escribir una dirección son veinte.
 *
 * El `sesion` es un token que agrupa la tanda de sugerencias con el detalle
 * final para que Google no las cobre aparte. Se renueva recién cuando el
 * usuario elige una dirección, porque ahí termina la tanda.
 */
export function CampoDireccionMapa({ onElegir }: { onElegir: (d: DireccionDeLugar) => void }) {
  const [texto, setTexto] = useState('');
  const [opciones, setOpciones] = useState<SugerenciaLugar[]>([]);
  const [error, setError] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const sesion = useRef(nuevaSesion());
  const yaAplicado = useRef<string | null>(null);

  useEffect(() => {
    const q = texto.trim();
    if (q.length < MINIMO) { setOpciones([]); setError(false); return; }

    // Elegir escribe la dirección completa en el campo, lo que vuelve a
    // disparar este efecto. Sin este corte, cada elección cuesta una consulta
    // paga de más —y con el token de sesión ya rotado, así que se cobra sola en
    // vez de ir dentro de la tanda— y la lista se reabre encima del formulario
    // justo después de que el usuario eligió.
    if (q === yaAplicado.current) return;

    let vivo = true;
    const timer = setTimeout(() => {
      setBuscando(true);
      lugares.sugerencias(q, sesion.current)
        .then(r => { if (vivo) { setOpciones(r.sugerencias); setError(false); } })
        .catch(() => { if (vivo) { setOpciones([]); setError(true); } })
        .finally(() => { if (vivo) setBuscando(false); });
    }, ESPERA_MS);

    return () => { vivo = false; clearTimeout(timer); };
  }, [texto]);

  async function elegir(s: SugerenciaLugar) {
    try {
      const d = await lugares.direccion(s.placeid, sesion.current);
      // La tanda terminó: la próxima búsqueda empieza una sesión nueva.
      sesion.current = nuevaSesion();
      yaAplicado.current = s.texto.trim();
      setOpciones([]);
      setTexto(s.texto);
      onElegir(d);
    } catch {
      setError(true);
    }
  }

  return (
    <div className="cdm">
      <label className="field">
        <span>Buscá tu dirección</span>
        <input
          className="input"
          value={texto}
          autoComplete="off"
          placeholder="Calle y altura, o el nombre del lugar"
          onChange={e => setTexto(e.target.value)}
        />
      </label>

      {buscando && <p className="cdm-estado">Buscando…</p>}

      {error && (
        <p className="cdm-estado cdm-error" role="status">
          No pudimos buscar en el mapa. Completá los campos de abajo a mano.
        </p>
      )}

      {opciones.length > 0 && (
        <ul className="cdm-lista" role="listbox">
          {opciones.map(s => (
            <li key={s.placeid}>
              <button type="button" role="option" aria-selected="false"
                className="cdm-opcion" onClick={() => elegir(s)}>
                {s.texto}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function nuevaSesion() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return String(Date.now()) + '-' + Math.random().toString(36).slice(2);
}
