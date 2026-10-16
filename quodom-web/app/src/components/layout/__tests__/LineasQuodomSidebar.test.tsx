import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { LineasQuodomSidebar } from '../LineasQuodomSidebar';
import { quodomLines } from '../../../api/quodom_lines';

vi.mock('../../../api/quodom_lines', () => ({
  quodomLines: { porQuodom: vi.fn(), update: vi.fn(), eliminar: vi.fn(), atributos: vi.fn() }
}));

const porQuodom = quodomLines.porQuodom as unknown as ReturnType<typeof vi.fn>;

const LATEX = { id: 11, idquodom: 'q-5', idproducto: 137, cantidad: 1, nombreProducto: 'Latex Interior' };
const RODILLO = { id: 12, idquodom: 'q-5', idproducto: 300, cantidad: 1, nombreProducto: 'Rodillo' };

function linea(nombre: string): HTMLElement {
  return screen.getByText(nombre).closest('li') as HTMLElement;
}

function cambio() {
  act(() => { window.dispatchEvent(new Event('quodom:changed')); });
}

beforeEach(() => { porQuodom.mockReset(); });

// Tocar + recarga las líneas del Quodom abierto. Antes la lista se desarmaba y
// en su lugar aparecía "Cargando productos…" hasta que contestaba el servidor:
// en producción se veía como que la página se recargaba.
describe('LineasQuodomSidebar · recargar sin parpadear', () => {
  it('mientras recarga sigue mostrando lo que había', async () => {
    porQuodom.mockResolvedValueOnce([LATEX]);
    render(<LineasQuodomSidebar modo="servidor" idquodom="q-5" />);
    await screen.findByText('Latex Interior');

    porQuodom.mockReturnValueOnce(new Promise(() => {}));
    cambio();

    expect(screen.getByText('Latex Interior')).toBeInTheDocument();
    expect(screen.queryByText(/cargando productos/i)).toBeNull();
  });

  it('la primera carga sí avisa que está cargando', () => {
    porQuodom.mockReturnValueOnce(new Promise(() => {}));
    render(<LineasQuodomSidebar modo="servidor" idquodom="q-5" />);
    expect(screen.getByText(/cargando productos/i)).toBeInTheDocument();
  });
});

// Y que se note qué entró: la línea nueva, o la que subió de cantidad porque
// era el mismo producto, se resalta.
describe('LineasQuodomSidebar · lo que acaba de entrar', () => {
  it('resalta la línea nueva', async () => {
    porQuodom.mockResolvedValueOnce([LATEX]);
    render(<LineasQuodomSidebar modo="servidor" idquodom="q-5" />);
    await screen.findByText('Latex Interior');

    porQuodom.mockResolvedValueOnce([LATEX, RODILLO]);
    cambio();

    await screen.findByText('Rodillo');
    expect(linea('Rodillo')).toHaveClass('lqs-linea-nueva');
    expect(linea('Latex Interior')).not.toHaveClass('lqs-linea-nueva');
  });

  it('resalta la que subió de cantidad', async () => {
    porQuodom.mockResolvedValueOnce([LATEX]);
    render(<LineasQuodomSidebar modo="servidor" idquodom="q-5" />);
    await screen.findByText('Latex Interior');

    porQuodom.mockResolvedValueOnce([{ ...LATEX, cantidad: 2 }]);
    cambio();

    await waitFor(() => expect(linea('Latex Interior')).toHaveClass('lqs-linea-nueva'));
  });

  it('la primera carga no resalta nada', async () => {
    porQuodom.mockResolvedValueOnce([LATEX, RODILLO]);
    render(<LineasQuodomSidebar modo="servidor" idquodom="q-5" />);
    await screen.findByText('Rodillo');
    expect(linea('Rodillo')).not.toHaveClass('lqs-linea-nueva');
  });

  it('otra recarga sin nada nuevo apaga el resaltado anterior', async () => {
    porQuodom.mockResolvedValueOnce([LATEX]);
    render(<LineasQuodomSidebar modo="servidor" idquodom="q-5" />);
    await screen.findByText('Latex Interior');

    porQuodom.mockResolvedValueOnce([LATEX, RODILLO]);
    cambio();
    await waitFor(() => expect(linea('Rodillo')).toHaveClass('lqs-linea-nueva'));

    porQuodom.mockResolvedValueOnce([LATEX, { ...RODILLO }]);
    cambio();
    await waitFor(() => expect(linea('Rodillo')).not.toHaveClass('lqs-linea-nueva'));
  });

  it('bajar la cantidad no es algo que haya entrado', async () => {
    porQuodom.mockResolvedValueOnce([{ ...LATEX, cantidad: 3 }]);
    render(<LineasQuodomSidebar modo="servidor" idquodom="q-5" />);
    await screen.findByText('Latex Interior');

    porQuodom.mockResolvedValueOnce([{ ...LATEX, cantidad: 2 }]);
    cambio();

    await waitFor(() => expect(porQuodom).toHaveBeenCalledTimes(2));
    await act(async () => {});
    expect(linea('Latex Interior')).not.toHaveClass('lqs-linea-nueva');
  });
});
