import { AuthProvider } from './auth/AuthContext';
import { AppRouter } from './router/routes';

export function App() {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  );
}
