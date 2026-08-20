export type ModoIa = 'chat' | 'lista';

// Sólo traduce clicks: tocar la pestaña activa pide null (cerrar) y tocar la
// otra pide el modo nuevo. Quién guarda el estado es el home.
export function PestanasIA({
  activo,
  onElegir
}: {
  activo: ModoIa | null;
  onElegir: (modo: ModoIa | null) => void;
}) {
  function clase(modo: ModoIa) {
    return 'home-ia-tab' + (activo === modo ? ' home-ia-tab-activa' : '');
  }

  return (
    <nav className="home-ia-tabs" aria-label="Asistente">
      <button
        type="button"
        className={clase('chat')}
        aria-pressed={activo === 'chat'}
        onClick={() => onElegir(activo === 'chat' ? null : 'chat')}
      >
        Conversando
      </button>
      <button
        type="button"
        className={clase('lista')}
        aria-pressed={activo === 'lista'}
        onClick={() => onElegir(activo === 'lista' ? null : 'lista')}
      >
        Subí tu lista
      </button>
    </nav>
  );
}
