import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';

export default function RootLayout() {
  const [isNavOpen, setIsNavOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('quodom_token');
    navigate('/login');
  };

  const toggleNav = () => {
    setIsNavOpen(!isNavOpen);
  };

  const closeNav = () => {
    setIsNavOpen(false);
  };

  return (
    <div className="app-container">
      <header className="main-header">
        <div className="logo-container">
          <NavLink to="/home" className="logo" onClick={closeNav}>
            QUODOM
          </NavLink>
        </div>

        {/* Mobile Navigation Toggle Button */}
        <button
          type="button"
          className="menu-toggle"
          onClick={toggleNav}
          aria-label={isNavOpen ? 'Cerrar menú' : 'Abrir menú'}
          aria-expanded={isNavOpen}
        >
          <span style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>
            {isNavOpen ? '✕' : '☰'}
          </span>
        </button>

        {/* Navigation Menu */}
        <nav className={`main-nav ${isNavOpen ? 'open' : ''}`} aria-label="Menú principal">
          <NavLink
            to="/home"
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            onClick={closeNav}
          >
            Inicio
          </NavLink>
          <NavLink
            to="/my-quodoms"
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            onClick={closeNav}
          >
            Mis Quodoms
          </NavLink>
          <button
            type="button"
            className="btn-logout"
            onClick={() => {
              closeNav();
              handleLogout();
            }}
          >
            Salir
          </button>
        </nav>
      </header>

      {/* Main Content Area */}
      <main className="main-content">
        <Outlet />
      </main>

      {/* Footer Area */}
      <footer className="main-footer">
        <p>&copy; {new Date().getFullYear()} QUODOM. Todos los derechos reservados. Agencia CMD Soluciones.</p>
      </footer>
    </div>
  );
}
