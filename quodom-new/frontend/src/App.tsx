import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import RootLayout from './layouts/RootLayout';
import Login from './pages/Login';
import Register from './pages/Register';
import Home from './pages/Home';
import MyQuodoms from './pages/MyQuodoms';
import QuodomEditor from './pages/QuodomEditor';
import Products from './pages/Products';
import NotFound from './pages/NotFound';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public auth routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Protected routes wrapped in RootLayout */}
        <Route element={<RootLayout />}>
          <Route path="/" element={<Navigate to="/home" replace />} />
          <Route path="/home" element={<Home />} />
          <Route path="/my-quodoms" element={<MyQuodoms />} />
          <Route path="/quodom/:id" element={<QuodomEditor />} />
          <Route path="/products" element={<Products />} />
        </Route>

        {/* Fallback 404 route */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
