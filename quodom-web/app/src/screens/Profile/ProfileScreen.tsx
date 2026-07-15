import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { AppBarBack } from '../../components/layout/AppBarBack';
import './ProfileScreen.css';

export function ProfileScreen() {
  const { user, signout } = useAuth();
  return (
    <>
      <AppBarBack title="Perfil" />
      <section className="container profile">
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
      </section>
    </>
  );
}
