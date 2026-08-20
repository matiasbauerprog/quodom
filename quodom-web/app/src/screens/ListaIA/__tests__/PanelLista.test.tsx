import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PanelLista } from '../PanelLista';
import { useAuth } from '../../../auth/AuthContext';
import { listaApi } from '../../../api/lista';
import { quodom as quodomApi } from '../../../api/quodom';
import { quodomLines } from '../../../api/quodom_lines';

vi.mock('../../../auth/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../../../api/lista', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/lista')>();
  return { ...actual, listaApi: { procesar: vi.fn() } };
});
vi.mock('../../../api/quodom', () => ({
  quodom: { activoPorRubro: vi.fn(), create: vi.fn() }
}));
vi.mock('../../../api/quodom_lines', () => ({
  quodomLines: { add: vi.fn() }
}));

const mockProcesar = listaApi.procesar as unknown as ReturnType<typeof vi.fn>;
const mockActivoPorRubro = quodomApi.activoPorRubro as unknown as ReturnType<typeof vi.fn>;
const mockAdd = quodomLines.add as unknown as ReturnType<typeof vi.fn>;

const RESPUESTA = {
  res: true as const,
  grupos: [
    {
      idrubro: 1, rubro: 'Limpieza',
      items: [{ textoOriginal: '3 lavandinas', idproducto: 8001, nombreProducto: 'Lavandina 5L', cantidad: 3 }]
    },
    {
      idrubro: 2, rubro: 'Librería',
      items: [{ textoOriginal: '2 resmas', idproducto: 8002, nombreProducto: 'Resma A4 75g', cantidad: 2 }]
    }
  ],
  noEncontrados: [{ textoOriginal: '1 escalera', motivo: 'no está en el catálogo' }],
  lineasIgnoradas: 0
};

beforeEach(() => {
  mockProcesar.mockReset();
  mockActivoPorRubro.mockReset();
  mockAdd.mockReset();
  vi.mocked(useAuth).mockReturnValue(
    { user: { id: 'u1', nombre: 'Ana' }, signout: vi.fn() } as unknown as ReturnType<typeof useAuth>
  );
});

function renderYEnviar(respuesta: unknown = RESPUESTA) {
  mockProcesar.mockResolvedValue(respuesta);
  render(<MemoryRouter><PanelLista /></MemoryRouter>);
  fireEvent.change(screen.getByLabelText(/pegá tu lista/i), {
    target: { value: '3 lavandinas\n2 resmas\n1 escalera' }
  });
  fireEvent.click(screen.getByRole('button', { name: /buscar en el catálogo/i }));
}

describe('PanelLista', () => {
  it('muestra un grupo por rubro', async () => {
    renderYEnviar();
    await waitFor(() => expect(screen.getByText(/Limpieza/)).toBeInTheDocument());
    expect(screen.getByText(/Librería/)).toBeInTheDocument();
    expect(screen.getByText('Lavandina 5L')).toBeInTheDocument();
    expect(screen.getByText('Resma A4 75g')).toBeInTheDocument();
  });

  it('muestra los no encontrados con su texto original', async () => {
    renderYEnviar();
    await waitFor(() => expect(screen.getByRole('region', { name: /no encontr/i })).toBeInTheDocument());
    const region = screen.getByRole('region', { name: /no encontr/i });
    expect(within(region).getByText(/1 escalera/)).toBeInTheDocument();
    expect(within(region).getByText(/no está en el catálogo/)).toBeInTheDocument();
  });

  it('avisa cuántas líneas quedaron afuera', async () => {
    renderYEnviar({ ...RESPUESTA, lineasIgnoradas: 12 });
    await waitFor(() => expect(screen.getByText(/12/)).toBeInTheDocument());
  });

  it('no muestra el bloque de no encontrados cuando matcheó todo', async () => {
    renderYEnviar({ ...RESPUESTA, noEncontrados: [] });
    await waitFor(() => expect(screen.getByText(/Limpieza/)).toBeInTheDocument());
    expect(screen.queryByText(/no encontr/i)).not.toBeInTheDocument();
  });

  it('avisa cuando no matcheó nada', async () => {
    renderYEnviar({ res: true, grupos: [], ambiguas: [], noEncontrados: [], lineasIgnoradas: 0 });
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/no encontré/i));
  });

  it('confirmar un grupo no navega ni oculta los demás: el segundo grupo sigue confirmable', async () => {
    mockActivoPorRubro.mockResolvedValue({ id: 'Q-1' });
    mockAdd.mockResolvedValue(undefined);

    renderYEnviar();
    await waitFor(() => expect(screen.getByText(/Limpieza/)).toBeInTheDocument());
    expect(screen.getByText(/Librería/)).toBeInTheDocument();

    const botones = screen.getAllByRole('button', { name: /agregar al quodom/i });
    expect(botones).toHaveLength(2);

    fireEvent.click(botones[0]);

    await waitFor(() => expect(screen.getAllByText(/Agregado/)).toHaveLength(1));

    // El primer grupo quedó marcado y el segundo sigue en pantalla y confirmable:
    // la pantalla no navegó a otro lado.
    expect(screen.getByText(/Librería/)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /agregar al quodom/i })).toHaveLength(1);
    expect(mockAdd).toHaveBeenCalledTimes(1);
  });

  it('muestra el error del servidor y deja volver a intentar', async () => {
    mockProcesar.mockRejectedValue(new Error('La IA está sobrecargada en este momento.'));
    render(<MemoryRouter><PanelLista /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText(/pegá tu lista/i), { target: { value: 'lavandina' } });
    fireEvent.click(screen.getByRole('button', { name: /buscar en el catálogo/i }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/sobrecargada/i));
    expect(screen.getByRole('button', { name: /buscar en el catálogo/i })).toBeEnabled();
  });
});

describe('PanelLista (invitado)', () => {
  beforeEach(() => mockProcesar.mockClear());

  it('pide login al enviar la lista y no llama al API', async () => {
    vi.mocked(useAuth).mockReturnValue(
      { user: null, signout: vi.fn() } as unknown as ReturnType<typeof useAuth>
    );
    render(<MemoryRouter><PanelLista /></MemoryRouter>);

    fireEvent.change(screen.getByLabelText(/pegá tu lista/i), { target: { value: '3 lavandinas' } });
    fireEvent.click(screen.getByRole('button', { name: /buscar en el catálogo/i }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/iniciar sesión/i));
    expect(mockProcesar).not.toHaveBeenCalled();
  });
});

const CON_AMBIGUA = {
  res: true as const,
  grupos: [
    {
      idrubro: 1, rubro: 'Limpieza',
      items: [{ textoOriginal: '3 lavandinas', idproducto: 8001, nombreProducto: 'Lavandina 5L', cantidad: 3 }]
    }
  ],
  ambiguas: [
    {
      textoOriginal: '3 platos descartables',
      cantidad: 3,
      sugerido: 493,
      candidatos: [
        { idproducto: 455, nombreProducto: 'Plato por 10 unidades', idrubro: 3, rubro: 'Papelera' },
        { idproducto: 493, nombreProducto: 'Plato descartable por 100 unidades', idrubro: 3, rubro: 'Papelera' }
      ]
    }
  ],
  noEncontrados: [],
  lineasIgnoradas: 0
};

async function enviarCon(respuesta: unknown) {
  mockProcesar.mockResolvedValue(respuesta);
  render(<MemoryRouter><PanelLista /></MemoryRouter>);
  fireEvent.change(screen.getByLabelText(/pegá tu lista/i), { target: { value: '3 lavandinas\n3 platos descartables' } });
  fireEvent.click(screen.getByRole('button', { name: /buscar en el catálogo/i }));
}

describe('PanelLista (líneas ambiguas)', () => {
  it('muestra el bloque de elección arriba de los grupos', async () => {
    await enviarCon(CON_AMBIGUA);

    expect(await screen.findByRole('region', { name: /tenés que elegir/i })).toBeInTheDocument();
    expect(screen.getByText(/Limpieza/)).toBeInTheDocument();
    expect(screen.getAllByText(/Papelera/).length).toBeGreaterThan(0);
  });

  it('elegir un candidato lo saca del bloque y crea el grupo de su rubro', async () => {
    await enviarCon(CON_AMBIGUA);
    await screen.findByRole('region', { name: /tenés que elegir/i });

    fireEvent.click(screen.getByRole('button', { name: /plato descartable por 100 unidades/i }));

    await waitFor(() => expect(screen.queryByRole('region', { name: /tenés que elegir/i })).toBeNull());
    expect(screen.getByText('Plato descartable por 100 unidades')).toBeInTheDocument();
    expect(screen.getByText(/Papelera — 1 producto/)).toBeInTheDocument();
  });

  it('descartar una línea no la agrega a ningún grupo', async () => {
    await enviarCon(CON_AMBIGUA);
    await screen.findByRole('region', { name: /tenés que elegir/i });

    fireEvent.click(screen.getByRole('button', { name: /descartar/i }));

    await waitFor(() => expect(screen.queryByRole('region', { name: /tenés que elegir/i })).toBeNull());
    expect(screen.queryByText(/Papelera/)).toBeNull();
  });

  it('avisa en el grupo cuántas líneas quedan sin resolver', async () => {
    await enviarCon(CON_AMBIGUA);

    expect(await screen.findByText(/1 línea sin resolver/i)).toBeInTheDocument();
  });

  it('sin ambiguas no dibuja el bloque', async () => {
    await enviarCon({ ...CON_AMBIGUA, ambiguas: [] });

    await screen.findByText(/Limpieza/);
    expect(screen.queryByRole('region', { name: /tenés que elegir/i })).toBeNull();
  });
});
