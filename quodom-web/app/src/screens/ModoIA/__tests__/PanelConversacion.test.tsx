import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PanelConversacion } from '../PanelConversacion';
import { iaApi } from '../../../api/ia';
import { quodom } from '../../../api/quodom';
import { quodomLines } from '../../../api/quodom_lines';
import { useAuth } from '../../../auth/AuthContext';

vi.mock('../../../api/ia', () => ({
  iaApi: { chat: vi.fn() }
}));
vi.mock('../../../api/quodom', () => ({
  quodom: { activoPorRubro: vi.fn(), create: vi.fn(), eliminar: vi.fn() }
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

describe('PanelConversacion (confirming a proposal, reuses the catalog rubro flow)', () => {
  beforeEach(() => {
    (iaApi.chat as unknown as ReturnType<typeof vi.fn>).mockReset();
    vi.mocked(quodom.activoPorRubro).mockReset();
    vi.mocked(quodom.create).mockReset();
    vi.mocked(quodom.eliminar).mockReset();
    vi.mocked(quodomLines.add).mockReset();
    mockNavigate.mockReset();
  });

  const ABIERTO = {
    id: 'Q-EXIST', descripcion: 'Mi Quodom', estado: 'CREADO' as const, nro: 'Q-1',
    createdBy: 'u1', iddireccion: null, idrubro: 5
  };

  // Antes sumaba sin preguntar, y el usuario se encontraba la propuesta metida
  // dentro del Quodom que ya venía armando. Un Quodom abierto por rubro sigue
  // siendo la regla, así que "uno nuevo" significa reemplazar al anterior.
  it('asks instead of adding when the rubro already has an open Quodom', async () => {
    vi.mocked(quodom.activoPorRubro).mockResolvedValue(ABIERTO);

    await enviarYProponer();
    fireEvent.click(screen.getByRole('button', { name: /agregar al quodom/i }));

    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    expect(quodom.activoPorRubro).toHaveBeenCalledWith(5);
    expect(quodomLines.add).not.toHaveBeenCalled();
    expect(quodom.create).not.toHaveBeenCalled();
    expect(quodom.eliminar).not.toHaveBeenCalled();
  });

  it('adds to the existing Quodom when the user chooses to integrate', async () => {
    vi.mocked(quodom.activoPorRubro).mockResolvedValue(ABIERTO);
    vi.mocked(quodomLines.add).mockResolvedValue({ res: true, id: 1 });

    await enviarYProponer();
    fireEvent.click(screen.getByRole('button', { name: /agregar al quodom/i }));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /sumar la propuesta/i }));

    await waitFor(() => expect(screen.getByText(/agregado/i)).toBeInTheDocument());
    expect(screen.getByRole('link', { name: /ver quodom/i })).toHaveAttribute('href', '/quodom?id=Q-EXIST');
    expect(quodomLines.add).toHaveBeenCalledWith(expect.objectContaining({ idquodom: 'Q-EXIST', idproducto: 300, cantidad: 2 }));
    expect(quodom.eliminar).not.toHaveBeenCalled();
    expect(quodom.create).not.toHaveBeenCalled();
  });

  it('discards the old Quodom and starts a new one when the user chooses to replace', async () => {
    vi.mocked(quodom.activoPorRubro).mockResolvedValue(ABIERTO);
    vi.mocked(quodom.eliminar).mockResolvedValue({ res: true });
    vi.mocked(quodom.create).mockResolvedValue({ res: true, idquodom: 'Q-NUEVO' });
    vi.mocked(quodomLines.add).mockResolvedValue({ res: true, id: 3 });

    await enviarYProponer();
    fireEvent.click(screen.getByRole('button', { name: /agregar al quodom/i }));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /reemplazar/i }));

    await waitFor(() => expect(screen.getByText(/agregado/i)).toBeInTheDocument());
    expect(quodom.eliminar).toHaveBeenCalledWith('Q-EXIST');
    expect(quodom.create).toHaveBeenCalledWith(expect.objectContaining({ idrubro: 5 }));
    expect(quodomLines.add).toHaveBeenCalledWith(expect.objectContaining({ idquodom: 'Q-NUEVO', idproducto: 300, cantidad: 2 }));
    expect(screen.getByRole('link', { name: /ver quodom/i })).toHaveAttribute('href', '/quodom?id=Q-NUEVO');
  });

  it('touches nothing when the user cancels the dialog', async () => {
    vi.mocked(quodom.activoPorRubro).mockResolvedValue(ABIERTO);

    await enviarYProponer();
    fireEvent.click(screen.getByRole('button', { name: /agregar al quodom/i }));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /ahora no|cancelar/i }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(quodomLines.add).not.toHaveBeenCalled();
    expect(quodom.eliminar).not.toHaveBeenCalled();
    expect(quodom.create).not.toHaveBeenCalled();
    // La propuesta sigue en pantalla para poder decidir de nuevo.
    expect(screen.getByRole('button', { name: /agregar al quodom/i })).toBeEnabled();
  });

  it('names the proposal, not a guest cart, in the dialog', async () => {
    vi.mocked(quodom.activoPorRubro).mockResolvedValue(ABIERTO);

    await enviarYProponer();
    fireEvent.click(screen.getByRole('button', { name: /agregar al quodom/i }));

    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    expect(screen.getByRole('dialog')).toHaveTextContent(/asistente te propuso 1 producto/i);
    expect(screen.getByRole('dialog')).not.toHaveTextContent(/sin iniciar sesión/i);
  });

  it('asks before creating a Quodom when the rubro has none open, then creates and adds on confirm', async () => {
    vi.mocked(quodom.activoPorRubro).mockResolvedValue(null);
    vi.mocked(quodom.create).mockResolvedValue({ res: true, idquodom: 'Q-NEW' });
    vi.mocked(quodomLines.add).mockResolvedValue({ res: true, id: 2 });

    await enviarYProponer();
    fireEvent.click(screen.getByRole('button', { name: /agregar al quodom/i }));

    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    expect(quodom.create).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /crear quodom de pintura/i }));

    await waitFor(() => expect(screen.getByText(/agregado/i)).toBeInTheDocument());
    expect(screen.getByRole('link', { name: /ver quodom/i })).toHaveAttribute('href', '/quodom?id=Q-NEW');
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(quodom.create).toHaveBeenCalledWith(expect.objectContaining({ idrubro: 5 }));
    expect(quodomLines.add).toHaveBeenCalledWith(expect.objectContaining({ idquodom: 'Q-NEW', idproducto: 300, cantidad: 2 }));
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
    vi.mocked(quodom.activoPorRubro).mockResolvedValue({
      id: 'Q-EXIST', descripcion: 'Mi Quodom', estado: 'CREADO', nro: 'Q-1',
      createdBy: 'u1', iddireccion: null, idrubro: 5
    });
    vi.mocked(quodomLines.add).mockResolvedValue({ res: true, id: 1 });

    renderWith();
    fireEvent.change(screen.getByPlaceholderText(/escrib/i), { target: { value: 'quiero pintar 60m2' } });
    fireEvent.click(screen.getByRole('button', { name: /enviar/i }));
    await waitFor(() => expect(screen.getByText('Latex Mate')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /agregar al quodom/i }));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /sumar la propuesta/i }));

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

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/iniciar sesión/i));
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
