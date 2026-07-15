import { Link } from 'react-router-dom';
import './SignIn.css';

export function CuentaCreada() {
  return (
    <div className="auth-screen">
      <div className="auth-card card">
        <h1>¡Cuenta creada!</h1>
        <p>Te enviamos un correo para validar tu email. Revisá tu casilla (y la carpeta de spam) y hacé clic en el link.</p>
        <Link to="/login" className="btn btn-block">Ir a ingresar</Link>
      </div>
    </div>
  );
}
