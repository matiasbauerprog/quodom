import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import './AppBarBack.css';

export function AppBarBack({ title, rightSlot }: { title: string; rightSlot?: ReactNode }) {
  const navigate = useNavigate();
  return (
    <header className="appbar-back">
      <button className="appbar-back-btn" aria-label="Volver" onClick={() => navigate(-1)}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
      </button>
      <h2 className="appbar-back-title">{title}</h2>
      {rightSlot ? <div className="appbar-back-right">{rightSlot}</div> : null}
    </header>
  );
}
