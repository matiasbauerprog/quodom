import { Link } from 'react-router-dom';
import './AvisoLogin.css';

export function AvisoLogin() {
  return (
    <p className="aviso-login" role="alert">
      Para usar el asistente necesitás <Link to="/login">iniciar sesión</Link>.
    </p>
  );
}
