import logo from '../assets/quodom-logo.svg';

/**
 * El logo de Quodom. Es el único lugar que apunta al archivo: para cambiar el
 * logo alcanza con reemplazar `assets/quodom-logo.svg`. El `alt` es "QUODOM"
 * para que lectores de pantalla (y los tests) lo sigan leyendo como la marca.
 */
export function Logo({ className }: { className?: string }) {
  return <img src={logo} alt="QUODOM" className={className} />;
}
