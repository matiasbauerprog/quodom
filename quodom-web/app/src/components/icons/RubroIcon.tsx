import './RubroIcon.css';

const C = {
  outline: '#3B3A48',
  purple: '#706F9A',
  lavender: '#B5B4D6',
  teal: '#4EBFB1',
  green: '#5FB878',
  darkGreen: '#2F7A5D',
  blue: '#4A90D9',
  darkBlue: '#2C5D93',
  cream: '#F4E4B8',
  orange: '#E28D3E',
  red: '#D75858',
  brown: '#8B5A3C',
  gray: '#9AA3AD',
  yellow: '#F5D24E',
  white: '#FFFFFF'
};

const s = { stroke: C.outline, strokeWidth: 2, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };
const line = { ...s, fill: 'none' };

const icons: Record<number, JSX.Element> = {
  1: (
    <g>
      <rect x="34" y="14" width="10" height="6" rx="1" fill={C.blue} {...s} />
      <path d="M32 20h14l-2 6h-10z" fill={C.darkBlue} {...s} />
      <rect x="30" y="26" width="18" height="30" rx="3" fill={C.blue} {...s} />
      <rect x="34" y="34" width="10" height="4" fill={C.lavender} {...s} />
      <path d="M56 24l6 8-6 8" fill={C.green} {...s} />
      <rect x="12" y="46" width="14" height="14" rx="2" fill={C.teal} {...s} />
      <path d="M14 46 l2 -18 l6 0 l2 18" fill={C.orange} {...s} />
      <path d="M52 52 l8 -14 l4 2 l-8 14z" fill={C.yellow} {...s} />
      <circle cx="60" cy="18" r="3" fill={C.lavender} {...s} />
      <circle cx="52" cy="12" r="2" fill={C.lavender} {...s} />
    </g>
  ),
  2: (
    <g>
      <rect x="14" y="46" width="46" height="10" rx="1" fill={C.red} {...s} />
      <rect x="14" y="38" width="46" height="10" rx="1" fill={C.green} {...s} />
      <rect x="14" y="30" width="46" height="10" rx="1" fill={C.blue} {...s} />
      <path d="M50 10 l10 6 l-24 24 l-8 2 l2 -8z" fill={C.yellow} {...s} />
      <path d="M50 10 l6 -4 l4 6 l-4 4z" fill={C.gray} {...s} />
      <path d="M30 34 l-2 8" {...line} />
    </g>
  ),
  3: (
    <g>
      <rect x="14" y="38" width="40" height="20" fill={C.cream} {...s} />
      <path d="M14 38 l20 -6 l40 0 l-20 6z" fill={C.yellow} {...s} />
      <path d="M54 38 l20 -6 l0 20 l-20 6z" fill={C.orange} {...s} />
      <path d="M22 44h24" {...line} />
      <path d="M22 50h20" {...line} />
      <rect x="42" y="14" width="12" height="14" rx="1" fill={C.white} {...s} />
      <path d="M44 18h8 M44 22h8 M44 26h5" {...line} />
    </g>
  ),
  4: (
    <g>
      <rect x="10" y="40" width="20" height="10" fill={C.red} {...s} />
      <rect x="30" y="40" width="20" height="10" fill={C.red} {...s} />
      <rect x="20" y="50" width="20" height="10" fill={C.red} {...s} />
      <rect x="40" y="50" width="20" height="10" fill={C.red} {...s} />
      <path d="M52 14 l10 6 l-22 22 l-6 -6z" fill={C.gray} {...s} />
      <path d="M52 14 l6 -6 l6 6 l-6 6z" fill={C.brown} {...s} />
      <path d="M30 34 l-4 6 l6 4" fill={C.brown} {...s} />
    </g>
  ),
  5: (
    <g>
      <path d="M18 22 h32 v6 h-32z" fill={C.gray} {...s} />
      <path d="M18 28 h32 l-4 30 h-24z" fill={C.teal} {...s} />
      <path d="M22 20 c0 -4 4 -8 12 -8 s12 4 12 8" {...line} />
      <path d="M42 30 v18" {...line} />
      <rect x="38" y="10" width="6" height="14" rx="1" fill={C.brown} {...s} />
      <rect x="36" y="6" width="10" height="8" rx="1" fill={C.white} {...s} />
      <path d="M50 48 c 4 4 4 8 0 8 s -4 -4 0 -8z" fill={C.teal} {...s} />
    </g>
  ),
  6: (
    <g>
      <rect x="20" y="30" width="24" height="20" rx="3" fill={C.white} {...s} />
      <path d="M20 50 h24 l-2 8 h-20z" fill={C.gray} {...s} />
      <rect x="46" y="16" width="6" height="16" rx="1" fill={C.gray} {...s} />
      <rect x="42" y="30" width="14" height="4" fill={C.gray} {...s} />
      <path d="M49 34 v6" {...line} />
      <path d="M49 40 c -3 4 -3 8 0 8 s 3 -4 0 -8z" fill={C.blue} {...s} />
      <circle cx="49" cy="16" r="4" fill={C.blue} {...s} />
    </g>
  ),
  7: (
    <g>
      <rect x="18" y="14" width="10" height="8" fill={C.brown} {...s} />
      <path d="M16 22 h14 v6 h-14z" fill={C.darkGreen} {...s} />
      <path d="M14 28 h18 v32 a4 4 0 0 1 -4 4 h-10 a4 4 0 0 1 -4 -4z" fill={C.darkGreen} {...s} />
      <rect x="16" y="38" width="14" height="10" fill={C.cream} {...s} />
      <rect x="42" y="18" width="10" height="6" fill={C.red} {...s} />
      <path d="M40 24 h14 v34 a3 3 0 0 1 -3 3 h-8 a3 3 0 0 1 -3 -3z" fill={C.blue} {...s} />
      <rect x="42" y="34" width="10" height="10" fill={C.white} {...s} />
    </g>
  ),
  8: (
    <g>
      <path d="M12 42 c0 -14 12 -22 24 -22 s24 8 24 22 v6 h-48z" fill={C.orange} {...s} />
      <path d="M12 48 h48 v4 h-48z" fill={C.brown} {...s} />
      <path d="M36 20 v -8 h4 v8" fill={C.gray} {...s} />
      <path d="M20 40 c 0 -10 6 -16 16 -16 s 16 6 16 16" {...line} />
      <path d="M32 42 h8" {...line} />
      <path d="M14 56 h20 v6 h-20z" fill={C.yellow} {...s} />
      <circle cx="24" cy="59" r="2" fill={C.outline} />
      <path d="M40 56 h20 v6 h-20z" fill={C.green} {...s} />
    </g>
  )
};

export function RubroIcon({ id, size = 72 }: { id: number; size?: number }) {
  const shape = icons[id];
  if (!shape) return null;
  return (
    <svg
      className="rubro-icon"
      width={size}
      height={size}
      viewBox="0 0 72 72"
      aria-hidden="true"
    >
      {shape}
    </svg>
  );
}
