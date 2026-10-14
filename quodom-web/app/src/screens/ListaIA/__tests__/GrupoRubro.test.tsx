import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { GrupoRubro } from '../GrupoRubro';
import { quodom } from '../../../api/quodom';
import { quodomLines } from '../../../api/quodom_lines';
import { abrirQuodom, abiertoDe } from '../../../quodom/quodomAbierto';

vi.mock('../../../api/quodom', () => ({
  quodom: { activosPorRubro: vi.fn(), create: vi.fn() }
}));
vi.mock('../../../api/quodom_lines', () => ({
  quodomLines: { add: vi.fn() }
}));

const GRUPO = {
  idrubro: 1,
  rubro: 'Limpieza',
  items: [
    { textoOriginal: '3 lavandinas 5L', idproducto: 8001, nombreProducto: 'Lavandina 5L', cantidad: 3 }
  ]
};

const mockActivos = quodom.activosPorRubro as unknown as ReturnType<typeof vi.fn>;
const mockCreate = quodom.create as unknown as ReturnType<typeof vi.fn>;
const mockAdd = quodomLines.add as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  localStorage.clear();
  mockActivos.mockReset();
  mockCreate.mockReset();
  mockAdd.mockReset();
  mockAdd.mockResolvedValue({ res: true, id: 1 });
});

function renderGrupo() {
  return render(<MemoryRouter><GrupoRubro grupo={GRUPO} /></MemoryRouter>);
}

describe('GrupoRubro', () => {
  it('muestra el rubro, la cantidad de productos y el renglón original', () => {
    renderGrupo();
    expect(screen.getByText(/Limpieza/)).toBeInTheDocument();
    expect(screen.getByText('Lavandina 5L')).toBeInTheDocument();
    expect(screen.getByText(/3 lavandinas 5L/)).toBeInTheDocument();
  });

  it('agrega al Quodom abierto del rubro y queda marcado como agregado', async () => {
    abrirQuodom(1, 'QD-9');
    renderGrupo();

    fireEvent.click(screen.getByRole('button', { name: /agregar al quodom/i }));

    await waitFor(() => expect(screen.getByText(/agregado/i)).toBeInTheDocument());
    expect(mockAdd).toHaveBeenCalledWith({
      idquodom: 'QD-9', idproducto: 8001, cantidad: 3, nombreProducto: 'Lavandina 5L'
    });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('pregunta a cuál sumarlo cuando no hay uno abierto, sin crear nada', async () => {
    mockActivos.mockResolvedValue([]);
    renderGrupo();

    fireEvent.click(screen.getByRole('button', { name: /agregar al quodom/i }));

    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockAdd).not.toHaveBeenCalled();
  });

  it('crea el Quodom al aceptar el diálogo y agrega las líneas', async () => {
    mockActivos.mockResolvedValue([]);
    mockCreate.mockResolvedValue({ res: true, idquodom: 'QD-10' });
    renderGrupo();

    fireEvent.click(screen.getByRole('button', { name: /agregar al quodom/i }));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /un quodom nuevo de limpieza/i }));

    await waitFor(() => expect(mockAdd).toHaveBeenCalled());
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ idrubro: 1 })
    );
    expect(abiertoDe(1)).toBe('QD-10');
  });

  it('suma al Quodom existente que el usuario elige y lo deja abierto', async () => {
    mockActivos.mockResolvedValue([{ id: 'QD-5', descripcion: 'Oficina', idrubro: 1, cantproductos: 2 }]);
    renderGrupo();

    fireEvent.click(screen.getByRole('button', { name: /agregar al quodom/i }));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /oficina/i }));

    await waitFor(() => expect(screen.getByText(/agregado/i)).toBeInTheDocument());
    expect(mockAdd).toHaveBeenCalledWith(expect.objectContaining({ idquodom: 'QD-5', idproducto: 8001 }));
    expect(mockCreate).not.toHaveBeenCalled();
    expect(abiertoDe(1)).toBe('QD-5');
  });

  it('no crea nada si se cancela el diálogo', async () => {
    mockActivos.mockResolvedValue([]);
    renderGrupo();

    fireEvent.click(screen.getByRole('button', { name: /agregar al quodom/i }));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /cancelar/i }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockAdd).not.toHaveBeenCalled();
  });

  it('muestra el error del servidor sin perder el grupo', async () => {
    mockActivos.mockRejectedValue(new Error('No se pudo consultar el Quodom.'));
    renderGrupo();

    fireEvent.click(screen.getByRole('button', { name: /agregar al quodom/i }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/no se pudo/i));
    expect(screen.getByText('Lavandina 5L')).toBeInTheDocument();
  });

  it('un reintento tras un error parcial no vuelve a agregar la línea que ya se guardó', async () => {
    abrirQuodom(1, 'QD-9');
    mockAdd.mockReset();
    mockActivos.mockResolvedValue([{ id: 'QD-9', descripcion: 'Limpieza casa', nro: 'QD-9' }]);
    mockAdd
      .mockResolvedValueOnce({ res: true, id: 1 })
      .mockRejectedValueOnce(new Error('Error de red'))
      .mockResolvedValueOnce({ res: true, id: 2 });

    const grupoDosItems = {
      idrubro: 1,
      rubro: 'Limpieza',
      items: [
        { textoOriginal: '3 lavandinas 5L', idproducto: 8001, nombreProducto: 'Lavandina 5L', cantidad: 3 },
        { textoOriginal: '2 esponjas', idproducto: 8002, nombreProducto: 'Esponja', cantidad: 2 }
      ]
    };
    render(<MemoryRouter><GrupoRubro grupo={grupoDosItems} /></MemoryRouter>);

    fireEvent.click(screen.getByRole('button', { name: /agregar al quodom/i }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());

    // El diálogo tiene el resto del lote: se reintenta desde ahí.
    fireEvent.click(screen.getByRole('button', { name: /Limpieza casa/ }));
    await waitFor(() => expect(screen.getByText(/agregado/i)).toBeInTheDocument());

    const llamadasItem1 = mockAdd.mock.calls.filter(([arg]) => arg.idproducto === 8001);
    expect(llamadasItem1).toHaveLength(1);
  });
});

describe('GrupoRubro (le llega un producto después de confirmar)', () => {
  it('vuelve a mostrar la propuesta y sólo agrega lo nuevo', async () => {
    abrirQuodom(1, 'QD-9');
    const { rerender } = render(<MemoryRouter><GrupoRubro grupo={GRUPO} /></MemoryRouter>);

    fireEvent.click(screen.getByRole('button', { name: /agregar al quodom/i }));
    await waitFor(() => expect(screen.getByText(/agregado/i)).toBeInTheDocument());
    expect(mockAdd).toHaveBeenCalledTimes(1);

    const conMas = {
      ...GRUPO,
      items: [
        ...GRUPO.items,
        { textoOriginal: '3 platos', idproducto: 8009, nombreProducto: 'Plato por 10 unidades', cantidad: 3 }
      ]
    };
    rerender(<MemoryRouter><GrupoRubro grupo={conMas} /></MemoryRouter>);

    expect(screen.getByText(/agregado/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /agregar al quodom/i }));

    await waitFor(() => expect(mockAdd).toHaveBeenCalledTimes(2));
    expect(mockAdd).toHaveBeenLastCalledWith(expect.objectContaining({ idproducto: 8009 }));
  });

  it('avisa cuántas líneas quedaron sin resolver arriba', () => {
    abrirQuodom(1, 'QD-9');
    render(<MemoryRouter><GrupoRubro grupo={GRUPO} pendientesSinResolver={2} /></MemoryRouter>);

    expect(screen.getByText(/2 líneas .*sin resolver/i)).toBeInTheDocument();
  });

  it('no avisa nada si no quedan líneas sin resolver', () => {
    abrirQuodom(1, 'QD-9');
    render(<MemoryRouter><GrupoRubro grupo={GRUPO} pendientesSinResolver={0} /></MemoryRouter>);

    expect(screen.queryByText(/sin resolver/i)).toBeNull();
  });
});
