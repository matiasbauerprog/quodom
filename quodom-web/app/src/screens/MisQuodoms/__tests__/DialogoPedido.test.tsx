import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DialogoPedido } from '../DialogoPedido';
import { quodom as quodomApi } from '../../../api/quodom';
import { quodomLines } from '../../../api/quodom_lines';
import { abrirQuodom } from '../../../quodom/quodomAbierto';

vi.mock('../../../api/quodom', () => ({ quodom: { porId: vi.fn(), repetir: vi.fn() } }));
vi.mock('../../../api/quodom_lines', () => ({ quodomLines: { porQuodom: vi.fn() } }));
vi.mock('../../../quodom/quodomAbierto', () => ({ abrirQuodom: vi.fn() }));

// El selector de proveedores tiene su propia suite y pega a Google: acá sólo
// interesa que esta ventana lo abra sobre el pedido que el usuario tocó.
vi.mock('../../../quodom/DialogoProveedores', () => ({
  DialogoProveedores: ({ idquodom }: { idquodom: string }) => <div data-testid="selector">selector de {idquodom}</div>
}));

const navigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const real = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...real, useNavigate: () => navigate };
});

const porId = quodomApi.porId as unknown as ReturnType<typeof vi.fn>;
const repetir = quodomApi.repetir as unknown as ReturnType<typeof vi.fn>;
const porQuodom = quodomLines.porQuodom as unknown as ReturnType<typeof vi.fn>;

const ENVIADO: Record<string, unknown> = {
  id: 'q-9', descripcion: 'Frente', estado: 'ENVIADO', nro: 'QD-9', idrubro: 5,
  nombrerubro: 'Pintura', cantproductos: 2, createdBy: 'u-1', iddireccion: 1,
  fechaenvio: new Date(Date.now() - 60 * 60 * 1000).toISOString()
};

const LINEAS = [
  { id: 1, idquodom: 'q-9', idproducto: 137, cantidad: 4, nombreProducto: 'Latex Interior Blanco Mate', nombreAtributo1: 'LITROS', atributo1: '4 litros' },
  { id: 2, idquodom: 'q-9', idproducto: 210, cantidad: 1, nombreProducto: 'Pincel 2"', nombreAtributo1: null, atributo1: null }
];

function montar(quodom: Record<string, unknown> = ENVIADO, onCerrar = vi.fn(), onRepetido = vi.fn()) {
  render(
    <MemoryRouter>
      <DialogoPedido quodom={quodom as never} onCerrar={onCerrar} onRepetido={onRepetido} />
    </MemoryRouter>
  );
  return { onCerrar, onRepetido };
}

describe('DialogoPedido', () => {
  beforeEach(() => {
    porId.mockReset(); repetir.mockReset(); porQuodom.mockReset();
    navigate.mockReset();
    vi.mocked(abrirQuodom).mockReset();
    porId.mockResolvedValue(ENVIADO);
    porQuodom.mockResolvedValue(LINEAS);
  });

  it('muestra las líneas del pedido con su cantidad y su atributo', async () => {
    montar();

    expect(await screen.findByText(/latex interior blanco mate/i)).toBeInTheDocument();
    expect(screen.getByText(/pincel 2/i)).toBeInTheDocument();
    expect(screen.getByText(/4 litros/i)).toBeInTheDocument();
  });

  // El pedido ya salió: el proveedor cotiza sobre lo que recibió. Editarlo acá
  // cambiaría el pedido sin que el proveedor se entere, y el usuario creería
  // que pidió otra cosa.
  it('no deja editar nada: ni cantidad, ni quitar, ni elegir atributo', async () => {
    montar();
    await screen.findByText(/latex interior blanco mate/i);

    expect(screen.queryByRole('button', { name: /quitar/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^\+$/ })).toBeNull();
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.queryByRole('spinbutton')).toBeNull();
  });

  it('a un pedido enviado le ofrece los dos caminos y ninguno más', async () => {
    montar(ENVIADO);
    await screen.findByText(/latex interior blanco mate/i);

    expect(screen.getByRole('button', { name: /otro proveedor/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /volver.*armado/i })).toBeEnabled();
    expect(screen.queryByRole('button', { name: /continuar/i })).toBeNull();
  });

  // "Enviar a otro proveedor" NO toca el pedido: sigue ENVIADO y en el
  // historial, y lo único que pasa es que se le suma un proveedor contactado.
  it('abre el selector sobre el mismo pedido, sin repetirlo', async () => {
    montar(ENVIADO);
    await screen.findByText(/latex interior blanco mate/i);

    fireEvent.click(screen.getByRole('button', { name: /otro proveedor/i }));

    expect(await screen.findByTestId('selector')).toHaveTextContent('selector de q-9');
    expect(repetir).not.toHaveBeenCalled();
  });

  // "Volver a armado" crea un pedido NUEVO: el enviado no se revierte, porque
  // revertirlo borraría la notificación y el historial de algo que sí pasó.
  // El nuevo queda abierto en el árbol de su rubro, que es "volver al sidebar",
  // y se abre con el nombre listo para cambiar: nace igual que el original.
  it('repite el pedido, deja el nuevo abierto en su rubro y lleva a nombrarlo', async () => {
    repetir.mockResolvedValue({ res: true, idquodom: 'q-nuevo' });
    const { onRepetido } = montar(ENVIADO);
    await screen.findByText(/latex interior blanco mate/i);

    fireEvent.click(screen.getByRole('button', { name: /volver.*armado/i }));

    await waitFor(() => expect(repetir).toHaveBeenCalledWith('q-9'));
    expect(abrirQuodom).toHaveBeenCalledWith(5, 'q-nuevo');
    await waitFor(() => expect(onRepetido).toHaveBeenCalledWith('q-nuevo'));
    expect(navigate).toHaveBeenCalledWith('/?quodom=q-nuevo&nombrar=1', { state: { ventanaQuodom: true } });
  });

  it('volver a armado abre el panel si estaba cerrado', async () => {
    localStorage.setItem('quodom.panelCerrado', '1');
    document.documentElement.dataset.panelCerrado = 'true';
    repetir.mockResolvedValue({ res: true, idquodom: 'q-nuevo' });
    montar(ENVIADO);
    await screen.findByText(/latex interior blanco mate/i);

    fireEvent.click(screen.getByRole('button', { name: /volver.*armado/i }));

    await waitFor(() => expect(document.documentElement.dataset.panelCerrado).toBeUndefined());
    expect(localStorage.getItem('quodom.panelCerrado')).toBeNull();
  });

  it('cierra con Escape', async () => {
    const { onCerrar } = montar();
    await screen.findByText(/latex interior blanco mate/i);

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(onCerrar).toHaveBeenCalled();
  });

  it('si no se pueden leer las líneas lo dice y deja cerrar', async () => {
    porQuodom.mockRejectedValue(new Error('no anda'));
    const { onCerrar } = montar();

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /cerrar/i }));
    expect(onCerrar).toHaveBeenCalled();
  });
});
