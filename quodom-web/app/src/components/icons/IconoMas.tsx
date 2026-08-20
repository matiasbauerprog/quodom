// El "+" tipográfico nunca queda ópticamente centrado dentro de un círculo:
// la fuente le deja aire distinto arriba y abajo. Dos trazos en un viewBox
// cuadrado sí quedan centrados, y el grosor no depende de la fuente cargada.
export function IconoMas({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
