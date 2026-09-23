import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import './AvisoLogin.css';

/**
 * Era un renglón al costado de la conversación y se perdía entre los mensajes:
 * el usuario escribía, no pasaba nada y no se enteraba de por qué. Como diálogo
 * corta lo que está haciendo, que es justamente lo que hay que comunicar.
 */
export function AvisoLogin({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="aviso-login-backdrop" onClick={onClose}>
      <section
        className="aviso-login card hoja"
        role="dialog"
        aria-modal="true"
        aria-labelledby="aviso-login-titulo"
        onClick={e => e.stopPropagation()}
      >
        <h2 id="aviso-login-titulo" className="aviso-login-titulo">Necesitás iniciar sesión</h2>
        <p className="aviso-login-texto">
          El asistente arma el Quodom en tu cuenta, así que primero tenés que entrar.
          Lo que escribiste queda acá.
        </p>
        <div className="aviso-login-acciones">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Ahora no</button>
          <Link to="/login" className="btn">Iniciar sesión</Link>
        </div>
      </section>
    </div>
  );
}
