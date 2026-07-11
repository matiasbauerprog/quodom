import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [company, setCompany] = useState('');
  const [cuit, setCuit] = useState('');
  const [address, setAddress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          name,
          whatsapp,
          company: company.trim() || undefined,
          cuit: cuit.trim() || undefined,
          address: address.trim() || undefined,
        }),
      });

      let data;
      try {
        data = await response.json();
      } catch (jsonErr) {
        throw new Error('El servidor backend no está respondiendo. Por favor, asegúrate de que esté iniciado en el puerto 3000.');
      }

      if (!response.ok) {
        throw new Error(data.error || 'Error al crear la cuenta');
      }

      // Save token to localStorage and redirect to home
      localStorage.setItem('quodom_token', data.token);
      navigate('/home');
    } catch (err: any) {
      console.error('Error de registro:', err);
      setError(err.message || 'Error de conexión con el servidor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="auth-page">
      <article className="auth-card register-card">
        <h1 className="auth-title register-title">Registrarse</h1>
        
        {error && (
          <div 
            className="error-message" 
            role="alert" 
          >
            ⚠️ {error}
          </div>
        )}

        <form className="auth-form register-form" onSubmit={handleSubmit}>
          <label className="form-group" htmlFor="name-input">
            <span className="form-label">Nombre Completo *</span>
            <input
              id="name-input"
              type="text"
              className="form-input"
              placeholder="Tu nombre completo"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
              required
            />
          </label>
          
          <label className="form-group" htmlFor="email-input">
            <span className="form-label">Email *</span>
            <input
              id="email-input"
              type="email"
              className="form-input"
              placeholder="ejemplo@quodom.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              required
            />
          </label>

          <label className="form-group" htmlFor="whatsapp-input">
            <span className="form-label">WhatsApp *</span>
            <input
              id="whatsapp-input"
              type="tel"
              className="form-input"
              placeholder="Ej: +5491122334455"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              disabled={loading}
              required
            />
          </label>

          <div className="register-form-grid">
            <label className="form-group" htmlFor="password-input">
              <span className="form-label">Contraseña *</span>
              <input
                id="password-input"
                type="password"
                className="form-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                required
              />
            </label>
            
            <label className="form-group" htmlFor="confirm-password-input">
              <span className="form-label">Confirmar *</span>
              <input
                id="confirm-password-input"
                type="password"
                className="form-input"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
                required
              />
            </label>
          </div>

          <hr className="register-divider" />
          
          <p className="register-section-title">Datos de Empresa (Opcional)</p>

          <div className="register-form-grid">
            <label className="form-group" htmlFor="company-input">
              <span className="form-label">Empresa</span>
              <input
                id="company-input"
                type="text"
                className="form-input"
                placeholder="Nombre Empresa"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                disabled={loading}
              />
            </label>

            <label className="form-group" htmlFor="cuit-input">
              <span className="form-label">CUIT</span>
              <input
                id="cuit-input"
                type="text"
                className="form-input"
                placeholder="30-XXXXXXXX-X"
                value={cuit}
                onChange={(e) => setCuit(e.target.value)}
                disabled={loading}
              />
            </label>
          </div>

          <label className="form-group" htmlFor="address-input">
            <span className="form-label">Dirección</span>
            <input
              id="address-input"
              type="text"
              className="form-input"
              placeholder="Calle 123, Ciudad"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              disabled={loading}
            />
          </label>

          <button 
            type="submit" 
            className="btn btn-violet auth-submit-btn" 
            disabled={loading}
          >
            {loading ? 'Creando Cuenta...' : 'Crear Cuenta'}
          </button>
        </form>
        
        <nav className="auth-links register-auth-links" aria-label="Enlaces de autenticación">
          <Link to="/login" className="auth-link">¿Ya tienes cuenta? Inicia Sesión</Link>
        </nav>
      </article>
    </section>
  );
}

