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
import { ListaMisQuodoms } from '../screens/MisQuodoms/ListaMisQuodoms';
import { ListaDirecciones } from '../screens/Direcciones/ListaDirecciones';
import { AgregarDireccion } from '../screens/Direcciones/AgregarDireccion';
import { ModificarDireccion } from '../screens/Direcciones/ModificarDireccion';
import { ProfileScreen } from '../screens/Profile/ProfileScreen';
import { DetalleUsuario } from '../screens/Profile/DetalleUsuario';
import { CambiarPass } from '../screens/Profile/CambiarPass';
import { ListaNotificaciones } from '../screens/Notificaciones/ListaNotificaciones';
import { ModoIA } from '../screens/ModoIA/ModoIA';

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
      { path: '/modo-ia', element: <ProtectedRoute><ModoIA /></ProtectedRoute> },
      { path: '/quodom', element: <DetalleQuodom /> },
      { path: '/mis-quodoms', element: <ProtectedRoute><ListaMisQuodoms /></ProtectedRoute> },
      { path: '/perfil', element: <ProtectedRoute><ProfileScreen /></ProtectedRoute> },
      { path: '/perfil/datos', element: <ProtectedRoute><DetalleUsuario /></ProtectedRoute> },
      { path: '/perfil/cambiar-pass', element: <ProtectedRoute><CambiarPass /></ProtectedRoute> },
      { path: '/direcciones', element: <ProtectedRoute><ListaDirecciones /></ProtectedRoute> },
      { path: '/direcciones/nuevo', element: <ProtectedRoute><AgregarDireccion /></ProtectedRoute> },
      { path: '/direcciones/:id', element: <ProtectedRoute><ModificarDireccion /></ProtectedRoute> },
      { path: '/notificaciones', element: <ProtectedRoute><ListaNotificaciones /></ProtectedRoute> }
    ]
  }
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
