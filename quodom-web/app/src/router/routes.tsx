import { createBrowserRouter, Outlet, RouterProvider } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';
import { ProtectedRoute } from '../auth/ProtectedRoute';

function Placeholder({ title }: { title: string }) {
  return <div className="container"><h1>{title}</h1></div>;
}

const router = createBrowserRouter([
  { path: '/login', element: <Placeholder title="Ingresar" /> },
  { path: '/registro', element: <Placeholder title="Crear cuenta" /> },
  { path: '/cuenta-creada', element: <Placeholder title="Cuenta creada" /> },
  { path: '/recuperar', element: <Placeholder title="Recuperar contraseña" /> },
  { path: '/reset/:token', element: <Placeholder title="Nueva contraseña" /> },
  { path: '/validar-email/:token', element: <Placeholder title="Validar email" /> },
  {
    element: <Layout><Outlet /></Layout>,
    children: [
      { path: '/', element: <Placeholder title="Inicio" /> },
      { path: '/categoria/:id', element: <Placeholder title="Subcategorías" /> },
      { path: '/subcategoria/:id', element: <Placeholder title="Productos" /> },
      { path: '/busqueda', element: <Placeholder title="Buscar" /> },
      { path: '/quodom', element: <Placeholder title="Mi Quodom" /> },
      { path: '/mis-quodoms', element: <ProtectedRoute><Placeholder title="Mis Quodoms" /></ProtectedRoute> },
      { path: '/perfil', element: <ProtectedRoute><Placeholder title="Perfil" /></ProtectedRoute> },
      { path: '/direcciones', element: <ProtectedRoute><Placeholder title="Direcciones" /></ProtectedRoute> },
      { path: '/notificaciones', element: <ProtectedRoute><Placeholder title="Notificaciones" /></ProtectedRoute> }
    ]
  }
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
