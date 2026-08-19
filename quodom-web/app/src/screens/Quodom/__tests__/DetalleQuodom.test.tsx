import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DetalleQuodom } from '../DetalleQuodom';
import { addGuestLine, clearGuestQuodoms, getGuestCart } from '../../../guest/guestQuodom';
import { useAuth } from '../../../auth/AuthContext';
import { quodom } from '../../../api/quodom';
import { quodomLines } from '../../../api/quodom_lines';
import { openWhatsappLink } from '../../../utils/whatsapp';
import { categorias } from '../../../api/categorias';
import type { Quodom } from '../../../api/types';

vi.mock('../../../auth/AuthContext', () => ({ useAuth: vi.fn(() => ({ user: null })) }));
vi.mock('../../../api/quodom', () => ({
  quodom: {
    misQuodom: vi.fn(),
    porId: vi.fn(),
    update: vi.fn(),
    whatsapp: vi.fn(),
    activoPorRubro: vi.fn(),
    create: vi.fn(),
    eliminar: vi.fn()
  }
}));
vi.mock('../../../api/quodom_lines', () => ({ quodomLines: { porQuodom: vi.fn(), update: vi.fn(), eliminar: vi.fn(), add: vi.fn() } }));
vi.mock('../../../utils/whatsapp', () => ({ openWhatsappLink: vi.fn() }));
vi.mock('../../../api/categorias', () => ({ categorias: { raiz: vi.fn() } }));

// GET /categorias sólo devuelve los rubros habilitados (RUBROS_ACTIVOS
// [1,2,3,5,7]); 4 (Construcción) está dado de baja en este lanzamiento.
const RUBROS_HABILITADOS = [1, 2, 3, 5, 7].map(id => ({
  id, nombrecategoria: 'Rubro ' + id, idcategoriapadre: 0, imagen: null, refreshImage: null, orden: id
}));

const GASEOSA = { idproducto: 700, nombreProducto: 'Gaseosa 2L', cantidad: 1 };
const CEMENTO = { idproducto: 400, nombreProducto: 'Cemento 50kg', cantidad: 1 };

const USUARIO_LOGUEADO = {
  id: 'u1', username: 'ana', email: 'ana@test.com', nombre: 'Ana'
};

function quodomExistente(overrides: Partial<Quodom> = {}): Quodom {
  return {
    id: 'Q-EXIST', descripcion: 'Bebidas de la oficina', estado: 'CREADO', nro: 'Q-100',
    createdBy: 'u1', iddireccion: null, idrubro: 7, cantproductos: 2, ...overrides
  };
}

function renderEn(ruta: string) {
  return render(<MemoryRouter initialEntries={[ruta]}><DetalleQuodom /></MemoryRouter>);
}

describe('DetalleQuodom for guests', () => {
  beforeEach(() => {
    clearGuestQuodoms();
    vi.mocked(useAuth).mockReturnValue({ user: null } as ReturnType<typeof useAuth>);
    vi.mocked(categorias.raiz).mockResolvedValue(RUBROS_HABILITADOS);
  });

  it('shows only the lines of the rubro in the query string', async () => {
    addGuestLine(7, GASEOSA);
    addGuestLine(4, CEMENTO);

    renderEn('/quodom?rubro=7');

    await waitFor(() => expect(screen.getByText('Gaseosa 2L')).toBeInTheDocument());
    expect(screen.queryByText('Cemento 50kg')).not.toBeInTheDocument();
  });

  it('lists the carts to choose from when no rubro is given and there are several', async () => {
    addGuestLine(7, GASEOSA);
    addGuestLine(4, CEMENTO);

    renderEn('/quodom');

    await waitFor(() => expect(screen.getByText('Bebidas')).toBeInTheDocument());
    expect(screen.getByText('Construcción')).toBeInTheDocument();
  });

  it('goes straight into the only cart when there is just one', async () => {
    addGuestLine(7, GASEOSA);

    renderEn('/quodom');

    await waitFor(() => expect(screen.getByText('Gaseosa 2L')).toBeInTheDocument());
  });

  it('does not crash on an unknown rubro id and shows an empty cart', async () => {
    addGuestLine(7, GASEOSA);

    renderEn('/quodom?rubro=999');

    await waitFor(() => expect(screen.getByText('Tu Quodom está vacío. Sumá productos desde Inicio.')).toBeInTheDocument());
  });

  it('treats a non-numeric rubro like a missing one', async () => {
    addGuestLine(7, GASEOSA);

    renderEn('/quodom?rubro=abc');

    await waitFor(() => expect(screen.getByText('Gaseosa 2L')).toBeInTheDocument());
  });

  it('treats an empty rubro param like a missing one', async () => {
    addGuestLine(7, GASEOSA);

    renderEn('/quodom?rubro=');

    await waitFor(() => expect(screen.getByText('Gaseosa 2L')).toBeInTheDocument());
  });
});

describe('DetalleQuodom con un carrito de un rubro dado de baja', () => {
  beforeEach(() => {
    clearGuestQuodoms();
    vi.clearAllMocks();
    vi.mocked(categorias.raiz).mockResolvedValue(RUBROS_HABILITADOS);
  });

  it('no ofrece enviar y explica por qué, sin tocar el carrito (invitado)', async () => {
    // Enviar dispara POST /quodom/create, que responde 400 idrubro_invalido
    // para un rubro que el catálogo ya no ofrece: no se ofrece el botón.
    vi.mocked(useAuth).mockReturnValue({ user: null } as ReturnType<typeof useAuth>);
    addGuestLine(4, CEMENTO);

    renderEn('/quodom?rubro=4');

    await waitFor(() => expect(screen.getByText('Cemento 50kg')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText(/no está disponible/i)).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Enviar por WhatsApp' })).toBeNull();
    // Los productos siguen siendo del usuario: el carrito no se borra.
    expect(getGuestCart(4).lines).toHaveLength(1);
  });

  it('no ofrece enviar tampoco con el usuario logueado', async () => {
    vi.mocked(useAuth).mockReturnValue({ user: USUARIO_LOGUEADO } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(quodom.activoPorRubro).mockResolvedValue(null);
    addGuestLine(4, CEMENTO);

    renderEn('/quodom?rubro=4');

    await waitFor(() => expect(screen.getByText(/no está disponible/i)).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Enviar por WhatsApp' })).toBeNull();
    expect(quodom.create).not.toHaveBeenCalled();
  });

  it('sigue ofreciendo enviar un rubro que el catálogo sí ofrece', async () => {
    vi.mocked(useAuth).mockReturnValue({ user: null } as ReturnType<typeof useAuth>);
    addGuestLine(7, GASEOSA);

    renderEn('/quodom?rubro=7');

    await waitFor(() => expect(screen.getByText('Gaseosa 2L')).toBeInTheDocument());
    expect(await screen.findByRole('button', { name: 'Enviar por WhatsApp' })).toBeEnabled();
    expect(screen.queryByText(/no está disponible/i)).toBeNull();
  });
});

describe('DetalleQuodom guest WhatsApp send (logged-in guest cart)', () => {
  beforeEach(() => {
    clearGuestQuodoms();
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({ user: USUARIO_LOGUEADO } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(categorias.raiz).mockResolvedValue(RUBROS_HABILITADOS);
  });

  it('migrates the cart and opens the WhatsApp link when the rubro has no open Quodom', async () => {
    addGuestLine(7, GASEOSA);
    vi.mocked(quodom.activoPorRubro).mockResolvedValue(null);
    vi.mocked(quodom.create).mockResolvedValue({ res: true, idquodom: 'Q-NEW' });
    vi.mocked(quodomLines.add).mockResolvedValue({ res: true, id: 1 });
    vi.mocked(quodom.whatsapp).mockResolvedValue({ res: true, link: 'https://wa.me/?text=hola-bebidas' });

    renderEn('/quodom?rubro=7');
    await waitFor(() => expect(screen.getByText('Gaseosa 2L')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Enviar por WhatsApp' }));

    await waitFor(() => expect(openWhatsappLink).toHaveBeenCalledWith('https://wa.me/?text=hola-bebidas'));

    expect(quodomLines.add).toHaveBeenCalledWith(expect.objectContaining({ idquodom: 'Q-NEW', idproducto: 700 }));
    // The rubro's cart is gone from localStorage — the whole point of "never
    // lose a guest's cart" is that it is only cleared once it is safely on
    // the server, which by this point it is.
    expect(getGuestCart(7).lines).toHaveLength(0);
  });

  it('shows the conflict dialog and, on "integrar", sends the lines to the existing Quodom', async () => {
    addGuestLine(7, GASEOSA);
    const existente = quodomExistente();
    vi.mocked(quodom.activoPorRubro).mockResolvedValue(existente);
    vi.mocked(quodomLines.add).mockResolvedValue({ res: true, id: 2 });
    vi.mocked(quodom.whatsapp).mockResolvedValue({ res: true, link: 'https://wa.me/?text=hola-integrado' });

    renderEn('/quodom?rubro=7');
    await waitFor(() => expect(screen.getByText('Gaseosa 2L')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Enviar por WhatsApp' }));

    await waitFor(() => expect(screen.getByText('Quodom de Bebidas ya abierto')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Integrar los dos' }));

    await waitFor(() => expect(openWhatsappLink).toHaveBeenCalledWith('https://wa.me/?text=hola-integrado'));

    // Integrar sends the guest's lines onto the existing Quodom, not a new one.
    expect(quodomLines.add).toHaveBeenCalledWith(expect.objectContaining({ idquodom: 'Q-EXIST', idproducto: 700 }));
    expect(quodom.create).not.toHaveBeenCalled();
    expect(getGuestCart(7).lines).toHaveLength(0);
  });

  it('keeps the cart in localStorage when the migration fails', async () => {
    addGuestLine(7, GASEOSA);
    vi.mocked(quodom.activoPorRubro).mockResolvedValue(null);
    vi.mocked(quodom.create).mockRejectedValue(new Error('network down'));

    renderEn('/quodom?rubro=7');
    await waitFor(() => expect(screen.getByText('Gaseosa 2L')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Enviar por WhatsApp' }));

    await waitFor(() => expect(screen.getByText('No se pudo enviar.')).toBeInTheDocument());

    expect(openWhatsappLink).not.toHaveBeenCalled();
    // The guarantee this test exists to protect: a failed migration must
    // never drop the guest's cart.
    expect(getGuestCart(7).lines).toEqual([expect.objectContaining({ idproducto: 700, nombreProducto: 'Gaseosa 2L' })]);
  });
});
