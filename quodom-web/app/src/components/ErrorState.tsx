import './ErrorState.css';

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="error-state" role="alert">
      <p>{message}</p>
      {onRetry && <button className="btn btn-ghost" onClick={onRetry}>Reintentar</button>}
    </div>
  );
}
