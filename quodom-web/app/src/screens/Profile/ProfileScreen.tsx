import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import './ProfileScreen.css';

export function ProfileScreen() {
  const { user, signout } = useAuth();
  return (
    <>
      {/* Sin flecha de volver: a Perfil se llega desde el menú, no desde una
          pantalla padre, y el logo del header ya es el camino al inicio. El
          título va adentro de la sección, igual que en Mis Quodoms, así entra
          en el centrado vertical. AppBarBack sigue en las pantallas anidadas
          (Mis datos, Cambiar contraseña), donde la flecha sí es la salida. */}
      <section className="container profile">
        <div className="pantalla-header"><h1>Perfil</h1></div>
        <div className="pantalla-contenido">
        <div className="profile-head card hoja">
          <div className="profile-name">{user?.nombre} {user?.apellido}</div>
          <div className="profile-email">{user?.email}</div>
          <div className="profile-username">@{user?.username}</div>
        </div>
        <ul className="profile-menu">
          <li><Link to="/perfil/datos" className="card hoja profile-link">Mis datos</Link></li>
          <li><Link to="/perfil/cambiar-pass" className="card hoja profile-link">Cambiar contraseña</Link></li>
          <li><Link to="/direcciones" className="card hoja profile-link">Mis direcciones</Link></li>
          <li><button className="card hoja profile-link profile-danger" onClick={signout}>Cerrar sesión</button></li>
        </ul>
        </div>
      </section>
    </>
  );
}
