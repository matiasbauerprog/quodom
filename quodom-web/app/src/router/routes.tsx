import { createBrowserRouter, Outlet, RouterProvider } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';
import { ProtectedRoute } from '../auth/ProtectedRoute';
import { SignIn } from '../screens/Auth/SignIn';
import { SignUp } from '../screens/Auth/SignUp';
import { CuentaCreada } from '../screens/Auth/CuentaCreada';
import { ForgotPassword } from '../screens/Auth/ForgotPassword';
import { ResetPassword } from '../screens/Auth/ResetPassword';
import { ValidarEmail } from '../screens/Auth/ValidarEmail';
import { SitioInicial } from '../screens/Home/SitioInicial';
import { SubcategoriaLista } from '../screens/Home/SubcategoriaLista';
import { ProductosPorCategoria } from '../screens/Home/ProductosPorCategoria';
import { BusquedaScreen } from '../screens/Home/BusquedaScreen';
import { DetalleQuodom } from '../screens/Quodom/DetalleQuodom';

function Placeholder({ title }: { title: string }) {
  return <div className="container"><h1>{title}</h1></div>;
}

const router = createBrowserRouter([
  { path: '/login', element: <SignIn /> },
  { path: '/registro', element: <SignUp /> },
  { path: '/cuenta-creada', element: <CuentaCreada /> },
  { path: '/recuperar', element: <ForgotPassword /> },
  { path: '/reset/:token', element: <ResetPassword /> },
  { path: '/validar-email/:token', element: <ValidarEmail /> },
  {
    element: <Layout><Outlet /></Layout>,
    children: [
      { path: '/', element: <SitioInicial /> },
      { path: '/categoria/:id', element: <SubcategoriaLista /> },
      { path: '/subcategoria/:id', element: <ProductosPorCategoria /> },
      { path: '/busqueda', element: <BusquedaScreen /> },
      { path: '/quodom', element: <DetalleQuodom /> },
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
