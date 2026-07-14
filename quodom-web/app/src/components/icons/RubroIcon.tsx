import './RubroIcon.css';

const icons: Record<number, JSX.Element> = {
  1: (
    <>
      <path d="M22 12h-8" />
      <path d="M18 8v8" />
      <rect x="10" y="16" width="14" height="20" rx="2" />
      <path d="M14 26h6" />
    </>
  ),
  2: (
    <>
      <path d="M28 8l6 6-18 18-8 2 2-8 18-18z" />
      <path d="M24 12l6 6" />
    </>
  ),
  3: (
    <>
      <rect x="10" y="6" width="20" height="26" rx="2" />
      <path d="M14 12h12" />
      <path d="M14 18h12" />
      <path d="M14 24h8" />
    </>
  ),
  4: (
    <>
      <path d="M12 24l-4 4 4 4 4-4z" />
      <path d="M14 22l14-14 4 4-14 14" />
      <path d="M22 10l6 6" />
    </>
  ),
  5: (
    <>
      <rect x="6" y="10" width="16" height="8" rx="1" />
      <path d="M22 14h6a2 2 0 0 1 2 2v6" />
      <path d="M28 22h4v6h-6v-4a2 2 0 0 1 2-2z" />
      <path d="M12 18v10" />
      <rect x="9" y="28" width="6" height="6" />
    </>
  ),
  6: (
    <>
      <path d="M20 4c-4 6-8 10-8 14a8 8 0 0 0 16 0c0-4-4-8-8-14z" />
    </>
  ),
  7: (
    <>
      <path d="M16 6h8v4l2 4v18a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2V14l2-4z" />
      <path d="M14 20h12" />
    </>
  ),
  8: (
    <>
      <path d="M8 16c0-6 5-10 12-10s12 4 12 10v6H8z" />
      <path d="M8 22h24" />
      <path d="M20 6v10" />
      <rect x="14" y="24" width="12" height="4" rx="1" />
    </>
  )
};

export function RubroIcon({ id, size = 48 }: { id: number; size?: number }) {
  const shape = icons[id];
  if (!shape) return null;
  return (
    <svg
      className="rubro-icon"
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {shape}
    </svg>
  );
}
