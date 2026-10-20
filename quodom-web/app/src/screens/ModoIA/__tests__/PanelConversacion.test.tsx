import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PanelConversacion } from '../PanelConversacion';
import { iaApi } from '../../../api/ia';
import { quodom } from '../../../api/quodom';
import { quodomLines } from '../../../api/quodom_lines';
import { useAuth } from '../../../auth/AuthContext';
import { abrirQuodom, abiertoDe } from '../../../quodom/quodomAbierto';
import { ApiError } from '../../../api/client';

vi.mock('../../../api/ia', () => ({
  iaApi: { chat: vi.fn() }
}));
vi.mock('../../../api/quodom', () => ({
  quodom: { activosPorRubro: vi.fn(), create: vi.fn() }
}));
vi.mock('../../../api/quodom_lines', () => ({
  quodomLines: { add: vi.fn() }
}));
vi.mock('../../../auth/AuthContext', () => ({ useAuth: vi.fn() }));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

function renderWith() {
  vi.mocked(useAuth).mockReturnValue(
    { user: { id: 'u1', nombre: 'Ana' }, signout: vi.fn() } as unknown as ReturnType<typeof useAuth>
  );
  return render(<MemoryRouter><PanelConversacion /></MemoryRouter>);
}

const PROPOSAL_REPLY = {
  type: 'proposal' as const,
  text: 'Listo, esto te propongo:',
  idrubro: 5,
  items: [{ idproducto: 300, cantidad: 2, motivo: 'cubre 12m²', nombreProducto: 'Latex premium 10L' }]
};

async function enviarYProponer() {
  (iaApi.chat as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(PROPOSAL_REPLY);
  renderWith();
  const input = screen.getByPlaceholderText(/escrib/i);
  fireEvent.change(input, { target: { value: 'quiero pintar 12m2' } });
  fireEvent.click(screen.getByRole('button', { name: /enviar/i }));
  await waitFor(() => expect(screen.getByText('Latex premium 10L')).toBeInTheDocument());
}

describe('PanelConversacion (base chat)', () => {
  beforeEach(() => { (iaApi.chat as unknown as ReturnType<typeof vi.fn>).mockReset(); });

  it('renders the hardcoded welcome message on mount', () => {
    renderWith();
    expect(screen.getByText(/contame tu proyecto/i)).toBeInTheDocument();
  });

  it('disables the send button when input is empty or busy', () => {
    renderWith();
    const send = screen.getByRole('button', { name: /enviar/i });
    expect(send).toBeDisabled();

    const input = screen.getByPlaceholderText(/escrib/i);
    fireEvent.change(input, { target: { value: 'hola' } });
    expect(send).toBeEnabled();
  });

  it('sends the message and renders the assistant reply', async () => {
    (iaApi.chat as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ type: 'question', text: '¿de qué color?' });
    renderWith();

    const input = screen.getByPlaceholderText(/escrib/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'quiero pintar' } });
    fireEvent.click(screen.getByRole('button', { name: /enviar/i }));

    await waitFor(() => expect(screen.getByText('¿de qué color?')).toBeInTheDocument());
    expect(screen.getByText('quiero pintar')).toBeInTheDocument();
    expect(iaApi.chat).toHaveBeenCalledWith([{ role: 'user', text: 'quiero pintar' }]);
  });

  it('renders backend errors as an assistant bubble', async () => {
    const err = new Error('Alcanzaste el límite diario.');
    (iaApi.chat as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(err);
    renderWith();

    const input = screen.getByPlaceholderText(/escrib/i);
    fireEvent.change(input, { target: { value: 'hola' } });
    fireEvent.click(screen.getByRole('button', { name: /enviar/i }));

    await waitFor(() => expect(screen.getByText(/alcanzaste el límite/i)).toBeInTheDocument());
  });
});

describe('PanelConversacion (confirming a proposal, same destination rule as the catalog "+")', () => {
  beforeEach(() => {
    (iaApi.chat as unknown as ReturnType<typeof vi.fn>).mockReset();
    vi.mocked(quodom.activosPorRubro).mockReset();
    vi.mocked(quodom.create).mockReset();
    vi.mocked(quodomLines.add).mockReset();
    mockNavigate.mockReset();
    localStorage.clear();
  });

  const OTRO = {
    id: 'Q-EXIST', descripcion: 'Casa', estado: 'CREADO' as const, nro: 'Q-1',
    createdBy: 'u1', iddireccion: null, idrubro: 5, cantproductos: 3
  };

  // Un rubro admite varios Quodoms: con uno abierto la propuesta va ahí, sin
  // pedir integrar / reemplazar / cancelar. Para separarla, el usuario arrastra.
  it('adds straight to the open Quodom of the rubro, without asking', async () => {
    abrirQuodom(5, 'Q-EXIST');
    vi.mocked(quodomLines.add).mockResolvedValue({ res: true, id: 1 });

    await enviarYProponer();
    fireEvent.click(screen.getByRole('button', { name: /agregar al quodom/i }));

    await waitFor(() => expect(screen.getByText(/agregado/i)).toBeInTheDocument());
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('link', { name: /ver quodom/i })).toHaveAttribute('href', '/?quodom=Q-EXIST');
    expect(quodomLines.add).toHaveBeenCalledWith(expect.objectContaining({ idquodom: 'Q-EXIST', idproducto: 300, cantidad: 2 }));
    expect(quodom.activosPorRubro).not.toHaveBeenCalled();
    expect(quodom.create).not.toHaveBeenCalled();
  });

  it('asks where to put it when the rubro has none open, and the choice becomes the open one', async () => {
    vi.mocked(quodom.activosPorRubro).mockResolvedValue([OTRO]);
    vi.mocked(quodomLines.add).mockResolvedValue({ res: true, id: 1 });

    await enviarYProponer();
    fireEvent.click(screen.getByRole('button', { name: /agregar al quodom/i }));

    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    expect(quodom.activosPorRubro).toHaveBeenCalledWith(5);
    expect(quodomLines.add).not.toHaveBeenCalled();
    expect(quodom.create).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /casa/i }));

    await waitFor(() => expect(screen.getByText(/agregado/i)).toBeInTheDocument());
    expect(screen.getByRole('link', { name: /ver quodom/i })).toHaveAttribute('href', '/?quodom=Q-EXIST');
    expect(quodomLines.add).toHaveBeenCalledWith(expect.objectContaining({ idquodom: 'Q-EXIST', idproducto: 300, cantidad: 2 }));
    expect(abiertoDe(5)).toBe('Q-EXIST');
  });

  it('creates a new Quodom only when the user asks for one', async () => {
    vi.mocked(quodom.activosPorRubro).mockResolvedValue([]);
    vi.mocked(quodom.create).mockResolvedValue({ res: true, idquodom: 'Q-NEW' });
    vi.mocked(quodomLines.add).mockResolvedValue({ res: true, id: 2 });

    await enviarYProponer();
    fireEvent.click(screen.getByRole('button', { name: /agregar al quodom/i }));

    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    expect(quodom.create).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /un quodom nuevo de pintura/i }));

    await waitFor(() => expect(screen.getByText(/agregado/i)).toBeInTheDocument());
    expect(screen.getByRole('link', { name: /ver quodom/i })).toHaveAttribute('href', '/?quodom=Q-NEW');
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(quodom.create).toHaveBeenCalledWith(expect.objectContaining({ idrubro: 5 }));
    expect(quodomLines.add).toHaveBeenCalledWith(expect.objectContaining({ idquodom: 'Q-NEW', idproducto: 300, cantidad: 2 }));
    expect(abiertoDe(5)).toBe('Q-NEW');
  });

  it('touches nothing when the user cancels the dialog', async () => {
    vi.mocked(quodom.activosPorRubro).mockResolvedValue([OTRO]);

    await enviarYProponer();
    fireEvent.click(screen.getByRole('button', { name: /agregar al quodom/i }));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /cancelar/i }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(quodomLines.add).not.toHaveBeenCalled();
    expect(quodom.create).not.toHaveBeenCalled();
    expect(abiertoDe(5)).toBeNull();
    // La propuesta sigue en pantalla para poder decidir de nuevo.
    expect(screen.getByRole('button', { name: /agregar al quodom/i })).toBeEnabled();
  });

  // Igual que el "+" de una tarjeta: si el Quodom recordado ya no existe
  // (borrado o enviado en otra pestaña) se olvida y se pregunta, no se falla.
  it('forgets an open Quodom that no longer exists and asks where to put it', async () => {
    abrirQuodom(5, 'Q-GONE');
    vi.mocked(quodomLines.add).mockRejectedValueOnce(new ApiError('Quodom no encontrado', 404));
    vi.mocked(quodom.activosPorRubro).mockResolvedValue([OTRO]);

    await enviarYProponer();
    fireEvent.click(screen.getByRole('button', { name: /agregar al quodom/i }));

    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    expect(abiertoDe(5)).toBeNull();
    expect(screen.queryByText('Quodom no encontrado')).toBeNull();
  });

  // Retomar, no reiniciar: si la línea 2 falla con el Quodom recordado, el
  // diálogo de destino sólo recibe lo que falta. Si no, la 1 llega dos veces.
  it('resumes a partly added batch instead of re-adding what already landed', async () => {
    (iaApi.chat as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      type: 'proposal' as const,
      text: 'Listo, esto te propongo:',
      idrubro: 5,
      items: [
        { idproducto: 301, cantidad: 1, motivo: 'a', nombreProducto: 'Producto Uno' },
        { idproducto: 302, cantidad: 1, motivo: 'b', nombreProducto: 'Producto Dos' },
        { idproducto: 303, cantidad: 1, motivo: 'c', nombreProducto: 'Producto Tres' }
      ]
    });
    abrirQuodom(5, 'Q-GONE');
    const llegaron: string[] = [];
    let fallo = true;
    vi.mocked(quodomLines.add).mockImplementation((async (l: { idquodom: string; idproducto: number }) => {
      if (l.idproducto === 302 && fallo) { fallo = false; throw new ApiError('Quodom no encontrado', 404); }
      llegaron.push(l.idquodom + ':' + l.idproducto);
      return { res: true, id: 1 };
    }) as never);
    vi.mocked(quodom.activosPorRubro).mockResolvedValue([OTRO]);

    renderWith();
    fireEvent.change(screen.getByPlaceholderText(/escrib/i), { target: { value: 'quiero pintar' } });
    fireEvent.click(screen.getByRole('button', { name: /enviar/i }));
    await waitFor(() => expect(screen.getByText('Producto Uno')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /agregar al quodom/i }));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /casa/i }));

    await waitFor(() => expect(screen.getByText(/agregado/i)).toBeInTheDocument());
    // La 301 entró en el Quodom recordado; al resolver el diálogo sólo faltaban 302 y 303.
    expect(llegaron).toEqual(['Q-GONE:301', 'Q-EXIST:302', 'Q-EXIST:303']);
  });

  it('shows a network failure in the destination dialog, which then owns the remainder', async () => {
    abrirQuodom(5, 'Q-EXIST');
    vi.mocked(quodomLines.add).mockRejectedValue(new Error('Sin conexión.'));

    await enviarYProponer();
    fireEvent.click(screen.getByRole('button', { name: /agregar al quodom/i }));

    await waitFor(() => expect(screen.getByText('Sin conexión.')).toBeInTheDocument());
    expect(screen.queryByText(/agregado/i)).toBeNull();
  });

  // El atributo elegido en el chat tiene que llegar a la línea; si no, el
  // Quodom queda con "LITROS: Elegir" y el usuario lo completa de nuevo a mano.
  it('sends the chosen attribute values along with the line', async () => {
    (iaApi.chat as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      type: 'proposal' as const,
      text: 'Listo, esto te propongo:',
      idrubro: 5,
      items: [{
        idproducto: 302, cantidad: 3, motivo: '60m² a 2 manos', nombreProducto: 'Latex Mate',
        nombreAtributo1: 'LITROS', atributo1: '20 litros',
        opcionesAtributo1: ['4 litros', '20 litros'],
        nombreAtributo2: 'MARCA', atributo2: null, opcionesAtributo2: ['Alba']
      }]
    });
    abrirQuodom(5, 'Q-EXIST');
    vi.mocked(quodomLines.add).mockResolvedValue({ res: true, id: 1 });

    renderWith();
    fireEvent.change(screen.getByPlaceholderText(/escrib/i), { target: { value: 'quiero pintar 60m2' } });
    fireEvent.click(screen.getByRole('button', { name: /enviar/i }));
    await waitFor(() => expect(screen.getByText('Latex Mate')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /agregar al quodom/i }));

    await waitFor(() => expect(quodomLines.add).toHaveBeenCalled());
    expect(quodomLines.add).toHaveBeenCalledWith({
      idquodom: 'Q-EXIST', idproducto: 302, cantidad: 3,
      nombreProducto: 'Latex Mate', atributo1: '20 litros'
    });
  });
});

describe('PanelConversacion (invitado)', () => {
  beforeEach(() => { (iaApi.chat as unknown as ReturnType<typeof vi.fn>).mockClear(); });

  it('pide login al enviar y no llama al API', async () => {
    vi.mocked(useAuth).mockReturnValue(
      { user: null, signout: vi.fn() } as unknown as ReturnType<typeof useAuth>
    );
    render(<MemoryRouter><PanelConversacion /></MemoryRouter>);

    fireEvent.change(screen.getByPlaceholderText(/escrib/i), { target: { value: 'quiero pintar' } });
    fireEvent.click(screen.getByRole('button', { name: /enviar/i }));

    await waitFor(() => expect(screen.getByRole('dialog')).toHaveTextContent(/iniciar sesión/i));
    expect(iaApi.chat).not.toHaveBeenCalled();
  });
});

// Escribir, mandar y tener que volver con el mouse al campo en cada vuelta es
// insoportable en una conversación. El campo pierde el foco porque se
// deshabilita mientras la IA piensa: deshabilitar un input lo desenfoca.
describe('PanelConversacion (el foco se queda en el campo)', () => {
  beforeEach(() => { (iaApi.chat as unknown as ReturnType<typeof vi.fn>).mockReset(); });

  it('deja seguir escribiendo mientras la IA piensa', async () => {
    let resolver: (v: unknown) => void = () => {};
    (iaApi.chat as unknown as ReturnType<typeof vi.fn>)
      .mockReturnValue(new Promise(r => { resolver = r; }));
    renderWith();

    const input = screen.getByPlaceholderText(/escrib/i);
    fireEvent.change(input, { target: { value: 'quiero pintar' } });
    fireEvent.click(screen.getByRole('button', { name: /enviar/i }));

    expect(input).not.toBeDisabled();
    await act(async () => { resolver({ type: 'question', text: 'ok' }); });
  });

  it('devuelve el foco al campo cuando llega la respuesta', async () => {
    (iaApi.chat as unknown as ReturnType<typeof vi.fn>)
      .mockResolvedValue({ type: 'question', text: '¿de qué color?' });
    renderWith();

    const input = screen.getByPlaceholderText(/escrib/i);
    fireEvent.change(input, { target: { value: 'quiero pintar' } });
    fireEvent.click(screen.getByRole('button', { name: /enviar/i }));

    await screen.findByText('¿de qué color?');
    await waitFor(() => expect(input).toHaveFocus());
  });
});
