import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { GrupoRubro } from '../GrupoRubro';
import { quodom } from '../../../api/quodom';
import { quodomLines } from '../../../api/quodom_lines';

vi.mock('../../../api/quodom', () => ({
  quodom: { activoPorRubro: vi.fn(), create: vi.fn() }
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

const mockActivo = quodom.activoPorRubro as unknown as ReturnType<typeof vi.fn>;
const mockCreate = quodom.create as unknown as ReturnType<typeof vi.fn>;
const mockAdd = quodomLines.add as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockActivo.mockReset();
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
    mockActivo.mockResolvedValue({ id: 'QD-9', idrubro: 1 });
    renderGrupo();

    fireEvent.click(screen.getByRole('button', { name: /agregar al quodom/i }));

    await waitFor(() => expect(screen.getByText(/agregado/i)).toBeInTheDocument());
    expect(mockAdd).toHaveBeenCalledWith({
      idquodom: 'QD-9', idproducto: 8001, cantidad: 3, nombreProducto: 'Lavandina 5L'
    });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('pide confirmación antes de crear un Quodom cuando no hay uno abierto', async () => {
    mockActivo.mockResolvedValue(null);
    renderGrupo();

    fireEvent.click(screen.getByRole('button', { name: /agregar al quodom/i }));

    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockAdd).not.toHaveBeenCalled();
  });

  it('crea el Quodom al aceptar el diálogo y agrega las líneas', async () => {
    mockActivo.mockResolvedValue(null);
    mockCreate.mockResolvedValue({ res: true, idquodom: 'QD-10' });
    renderGrupo();

    fireEvent.click(screen.getByRole('button', { name: /agregar al quodom/i }));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /crear quodom/i }));

    await waitFor(() => expect(mockAdd).toHaveBeenCalled());
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ idrubro: 1 })
    );
  });

  it('no crea nada si se cancela el diálogo', async () => {
    mockActivo.mockResolvedValue(null);
    renderGrupo();

    fireEvent.click(screen.getByRole('button', { name: /agregar al quodom/i }));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /cancelar/i }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockAdd).not.toHaveBeenCalled();
  });

  it('muestra el error del servidor sin perder el grupo', async () => {
    mockActivo.mockRejectedValue(new Error('No se pudo consultar el Quodom.'));
    renderGrupo();

    fireEvent.click(screen.getByRole('button', { name: /agregar al quodom/i }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/no se pudo/i));
    expect(screen.getByText('Lavandina 5L')).toBeInTheDocument();
  });

  it('un reintento tras un error parcial no vuelve a agregar la línea que ya se guardó', async () => {
    mockActivo.mockResolvedValue({ id: 'QD-9', idrubro: 1 });
    mockAdd.mockReset();
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

    fireEvent.click(screen.getByRole('button', { name: /agregar al quodom/i }));
    await waitFor(() => expect(screen.getByText(/agregado/i)).toBeInTheDocument());

    const llamadasItem1 = mockAdd.mock.calls.filter(([arg]) => arg.idproducto === 8001);
    expect(llamadasItem1).toHaveLength(1);
  });
});
