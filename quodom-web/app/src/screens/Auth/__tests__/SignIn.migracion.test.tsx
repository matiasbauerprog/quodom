import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { SignIn } from '../SignIn';
import { useAuth } from '../../../auth/AuthContext';
import { quodom as quodomApi } from '../../../api/quodom';
import { quodomLines } from '../../../api/quodom_lines';
import { categorias } from '../../../api/categorias';
import { addGuestLine, clearGuestQuodoms, getGuestCart } from '../../../guest/guestQuodom';

// A propósito NO se mockea migrateGuestQuodom: lo que este archivo cubre es
// justamente qué pide el login al backend y qué pasa con los carritos reales
// de localStorage.
vi.mock('../../../auth/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../../../api/quodom', () => ({
  quodom: { activoPorRubro: vi.fn(), create: vi.fn(), eliminar: vi.fn() }
}));
vi.mock('../../../api/quodom_lines', () => ({ quodomLines: { add: vi.fn() } }));
vi.mock('../../../api/categorias', () => ({ categorias: { raiz: vi.fn() } }));

const signin = vi.fn();

// GET /categorias devuelve sólo los rubros habilitados (RUBROS_ACTIVOS
// [1,2,3,5,7]); 4 (Construcción) está dado de baja en este lanzamiento.
const RUBROS_HABILITADOS = [1, 2, 3, 5, 7].map(id => ({
  id, nombrecategoria: 'Rubro ' + id, idcategoriapadre: 0, imagen: null, refreshImage: null, orden: id
}));

const CEMENTO = { idproducto: 400, nombreProducto: 'Cemento 50kg', cantidad: 1 };
const LAVANDINA = { idproducto: 100, nombreProducto: 'Lavandina 1L', cantidad: 2 };
const GASEOSA = { idproducto: 700, nombreProducto: 'Gaseosa 2L', cantidad: 1 };

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<SignIn />} />
        <Route path="/" element={<p>Inicio</p>} />
      </Routes>
    </MemoryRouter>
  );
}

function fillAndSubmit() {
  fireEvent.change(screen.getByLabelText(/usuario o email/i), { target: { value: 'ana' } });
  fireEvent.change(screen.getByLabelText(/contraseña/i), { target: { value: 'secreto123' } });
  fireEvent.click(screen.getByRole('button', { name: /ingresar/i }));
}

describe('SignIn migrando carritos de invitado', () => {
  beforeEach(() => {
    clearGuestQuodoms();
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({ signin } as unknown as ReturnType<typeof useAuth>);
    signin.mockResolvedValue(undefined);
    vi.mocked(categorias.raiz).mockResolvedValue(RUBROS_HABILITADOS);
    vi.mocked(quodomApi.activoPorRubro).mockResolvedValue(null);
    vi.mocked(quodomApi.create).mockResolvedValue({ res: true, idquodom: 'q-new' });
    vi.mocked(quodomLines.add).mockResolvedValue({ res: true, id: 1 });
  });

  it('deja entrar igual con un carrito de un rubro dado de baja, sin intentar crearlo', async () => {
    // El bug: POST /quodom/create de un rubro inactivo responde 400 y dejaba
    // al usuario ya autenticado encerrado en /login, sin AppBar ni Drawer.
    addGuestLine(4, CEMENTO);

    renderLogin();
    fillAndSubmit();

    await screen.findByText('Inicio');
    expect(screen.queryByLabelText(/usuario o email/i)).toBeNull();
    expect(quodomApi.create).not.toHaveBeenCalled();
    // El carrito no se borra nunca: sigue entero en localStorage.
    expect(getGuestCart(4).lines).toEqual([expect.objectContaining({ idproducto: 400 })]);
  });

  it('migra el carrito del rubro disponible y deja intacto el del rubro de baja', async () => {
    addGuestLine(1, LAVANDINA);
    addGuestLine(4, CEMENTO);

    renderLogin();
    fillAndSubmit();

    await screen.findByText('Inicio');
    expect(quodomApi.create).toHaveBeenCalledTimes(1);
    expect(quodomApi.create).toHaveBeenCalledWith(expect.objectContaining({ idrubro: 1 }));
    expect(quodomLines.add).toHaveBeenCalledWith(expect.objectContaining({ idquodom: 'q-new', idproducto: 100 }));
    expect(getGuestCart(1).lines).toHaveLength(0);
    expect(getGuestCart(4).lines).toHaveLength(1);
  });

  it('un rubro que falla no aborta la migración de los demás ni bloquea el ingreso', async () => {
    addGuestLine(1, LAVANDINA);
    addGuestLine(7, GASEOSA);
    vi.mocked(quodomApi.create).mockImplementation(async ({ idrubro }) => {
      if (idrubro === 1) throw new Error('network down');
      return { res: true, idquodom: 'q-7' };
    });

    renderLogin();
    fillAndSubmit();

    await screen.findByText('Inicio');
    expect(quodomApi.create).toHaveBeenCalledTimes(2);
    // El que falló conserva su carrito; el otro igual llegó al servidor.
    expect(getGuestCart(1).lines).toHaveLength(1);
    expect(getGuestCart(7).lines).toHaveLength(0);
    expect(quodomLines.add).toHaveBeenCalledWith(expect.objectContaining({ idquodom: 'q-7', idproducto: 700 }));
  });
});
