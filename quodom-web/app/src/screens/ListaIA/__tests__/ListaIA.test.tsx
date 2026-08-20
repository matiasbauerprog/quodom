import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ListaIA } from '../ListaIA';
import { listaApi } from '../../../api/lista';
import { quodom as quodomApi } from '../../../api/quodom';
import { quodomLines } from '../../../api/quodom_lines';

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
});

function renderYEnviar(respuesta: unknown = RESPUESTA) {
  mockProcesar.mockResolvedValue(respuesta);
  render(<MemoryRouter><ListaIA /></MemoryRouter>);
  fireEvent.change(screen.getByLabelText(/pegá tu lista/i), {
    target: { value: '3 lavandinas\n2 resmas\n1 escalera' }
  });
  fireEvent.click(screen.getByRole('button', { name: /buscar en el catálogo/i }));
}

describe('ListaIA', () => {
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
    renderYEnviar({ res: true, grupos: [], noEncontrados: [], lineasIgnoradas: 0 });
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
    render(<MemoryRouter><ListaIA /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText(/pegá tu lista/i), { target: { value: 'lavandina' } });
    fireEvent.click(screen.getByRole('button', { name: /buscar en el catálogo/i }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/sobrecargada/i));
    expect(screen.getByRole('button', { name: /buscar en el catálogo/i })).toBeEnabled();
  });
});
