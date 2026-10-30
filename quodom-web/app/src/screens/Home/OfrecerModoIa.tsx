import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import './OfrecerModoIa.css';

/**
 * El Modo IA ofrecido desde una búsqueda (2026-10-29): quienes probaron la app
 * escribieron en el buscador lo que hay que escribirle al asistente. Lo usan el
 * desplegable del inicio y la pantalla de búsqueda, adonde lleva Enter: ahí
 * también llegó un tester con "pintar" y no lo encontró.
 */
export function OfrecerModoIa({ texto, destacada, onClick }: {
  texto: string;
  destacada: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={'home-sugerencia-ia' + (destacada ? ' home-sugerencia-ia-destacada' : '')}
      onClick={onClick}
    >
      <span className="home-sugerencia-ia-icono" aria-hidden="true">✨</span>
      <span className="home-sugerencia-ia-texto">
        Preguntale al Modo IA: <q>{texto.trim()}</q>
      </span>
    </button>
  );
}

/** El texto viaja en el estado de la navegación y no en la URL: es lo que
 *  escribió la persona, y el inicio lo consume una vez (ver SitioInicial). */
export type EstadoPreguntaIa = { preguntaIa: string };

export function useAbrirModoIa() {
  const navigate = useNavigate();
  return useCallback((texto: string) => {
    const estado: EstadoPreguntaIa = { preguntaIa: texto.trim() };
    navigate('/?ia=chat', { state: estado });
  }, [navigate]);
}
