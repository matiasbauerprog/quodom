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
import { users } from '../../../api/users';
import { abrirQuodom } from '../../../quodom/quodomAbierto';
import { proveedores } from '../../../api/proveedores';

vi.mock('../../../auth/AuthContext', () => ({ useAuth: vi.fn(() => ({ user: null })) }));
vi.mock('../../../api/quodom', () => ({
  quodom: {
    misQuodom: vi.fn(),
    porId: vi.fn(),
    update: vi.fn(),
    whatsapp: vi.fn(),
    activosPorRubro: vi.fn(),
    create: vi.fn(),
    eliminar: vi.fn()
  }
}));
vi.mock('../../../api/quodom_lines', () => ({ quodomLines: { porQuodom: vi.fn(), update: vi.fn(), eliminar: vi.fn(), add: vi.fn(), atributos: vi.fn() } }));
vi.mock('../../../utils/whatsapp', () => ({ openWhatsappLink: vi.fn() }));
vi.mock('../../../api/categorias', () => ({ categorias: { raiz: vi.fn() } }));
vi.mock('../../../api/users', () => ({ users: { getDirecciones: vi.fn() } }));
// Cotizar abre el selector de proveedores, que consulta a Google al abrirse.
vi.mock('../../../api/proveedores', () => ({ proveedores: { delQuodom: vi.fn(), noEnviado: vi.fn() } }));

const LE_BLEU = {
  placeid: 'p1', nombre: 'Pinturerías Le Bleu', rating: 4.9, resenas: 190,
  distanciakm: 0.4, telefono: '+541166687854', telefonovisible: '011 6668-7854',
  sintelefono: false, sinwhatsapp: false, sindatos: false, direccion: 'Almte Brown 3185',
  contactadoen: null
};
const PROVEEDORES = {
  proveedores: [LE_BLEU], preciso: true, desde: 'Almte Brown 3185',
  atribucion: 'Resultados de Google'
};

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

function renderEn(ruta: string) {
  return render(<MemoryRouter initialEntries={[ruta]}><DetalleQuodom /></MemoryRouter>);
}

// La pantalla pregunta si el usuario tiene dirección para saber si puede
// enviar. Sin esta respuesta por defecto el mock devuelve undefined y el
// efecto rompe el render, arrastrando a los tests que vienen después.
beforeEach(() => {
  vi.mocked(users.getDirecciones).mockResolvedValue([{ id: 1 } as never]);
  vi.mocked(proveedores.delQuodom).mockResolvedValue(PROVEEDORES);
});

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
    expect(screen.queryByRole('button', { name: 'Cotizar por WhatsApp' })).toBeNull();
    // Los productos siguen siendo del usuario: el carrito no se borra.
    expect(getGuestCart(4).lines).toHaveLength(1);
  });

  it('no ofrece enviar tampoco con el usuario logueado', async () => {
    vi.mocked(useAuth).mockReturnValue({ user: USUARIO_LOGUEADO } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(quodom.activosPorRubro).mockResolvedValue([]);
    addGuestLine(4, CEMENTO);

    renderEn('/quodom?rubro=4');

    await waitFor(() => expect(screen.getByText(/no está disponible/i)).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Cotizar por WhatsApp' })).toBeNull();
    expect(quodom.create).not.toHaveBeenCalled();
  });

  it('sigue ofreciendo enviar un rubro que el catálogo sí ofrece', async () => {
    vi.mocked(useAuth).mockReturnValue({ user: null } as ReturnType<typeof useAuth>);
    addGuestLine(7, GASEOSA);

    renderEn('/quodom?rubro=7');

    await waitFor(() => expect(screen.getByText('Gaseosa 2L')).toBeInTheDocument());
    expect(await screen.findByRole('button', { name: 'Cotizar por WhatsApp' })).toBeEnabled();
    expect(screen.queryByText(/no está disponible/i)).toBeNull();
  });
});

describe('DetalleQuodom guest WhatsApp send (logged-in guest cart)', () => {
  beforeEach(() => {
    clearGuestQuodoms();
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({ user: USUARIO_LOGUEADO } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(categorias.raiz).mockResolvedValue(RUBROS_HABILITADOS);
    vi.mocked(users.getDirecciones).mockResolvedValue([{ id: 1 } as never]);
    vi.mocked(proveedores.delQuodom).mockResolvedValue(PROVEEDORES);
  });

  // El carrito se migra igual que antes, pero el envío pasa por el selector:
  // el comprador elige a quién, y "enviar sin elegir proveedor" es el camino
  // que existía antes de este feature.
  it('migrates the cart and sends it through the provider picker', async () => {
    addGuestLine(7, GASEOSA);
    vi.mocked(quodom.create).mockResolvedValue({ res: true, idquodom: 'Q-NEW' });
    vi.mocked(quodomLines.add).mockResolvedValue({ res: true, id: 1 });
    vi.mocked(quodom.whatsapp).mockResolvedValue({ res: true, link: 'https://wa.me/?text=hola-bebidas' });

    renderEn('/quodom?rubro=7');
    await waitFor(() => expect(screen.getByText('Gaseosa 2L')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Cotizar por WhatsApp' }));

    fireEvent.click(await screen.findByRole('button', { name: /enviar sin elegir/i }));
    await waitFor(() => expect(openWhatsappLink).toHaveBeenCalledWith('https://wa.me/?text=hola-bebidas'));

    expect(quodomLines.add).toHaveBeenCalledWith(expect.objectContaining({ idquodom: 'Q-NEW', idproducto: 700 }));
    // The rubro's cart is gone from localStorage — the whole point of "never
    // lose a guest's cart" is that it is only cleared once it is safely on
    // the server, which by this point it is.
    expect(getGuestCart(7).lines).toHaveLength(0);
  });

  it('migrates to a new Quodom without asking even when the rubro already has an open one', async () => {
    // Un rubro admite varios Quodoms abiertos: ya no hay conflicto que resolver.
    addGuestLine(7, GASEOSA);
    vi.mocked(quodom.create).mockResolvedValue({ res: true, idquodom: 'Q-NEW' });
    vi.mocked(quodomLines.add).mockResolvedValue({ res: true, id: 2 });
    vi.mocked(quodom.whatsapp).mockResolvedValue({ res: true, link: 'https://wa.me/?text=hola-nuevo' });

    renderEn('/quodom?rubro=7');
    await waitFor(() => expect(screen.getByText('Gaseosa 2L')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Cotizar por WhatsApp' }));

    fireEvent.click(await screen.findByRole('button', { name: /enviar sin elegir/i }));
    await waitFor(() => expect(openWhatsappLink).toHaveBeenCalledWith('https://wa.me/?text=hola-nuevo'));
    // El único diálogo que aparece es el selector de proveedores: el de
    // conflicto de rubro no existe más, un rubro admite varios Quodoms.
    expect(screen.queryByText(/integrar|reemplazar/i)).toBeNull();
    expect(quodom.create).toHaveBeenCalledWith(expect.objectContaining({ idrubro: 7 }));
    expect(quodom.eliminar).not.toHaveBeenCalled();
    expect(quodomLines.add).toHaveBeenCalledWith(expect.objectContaining({ idquodom: 'Q-NEW', idproducto: 700 }));
    expect(getGuestCart(7).lines).toHaveLength(0);
  });

  it('keeps the cart in localStorage when the migration fails', async () => {
    addGuestLine(7, GASEOSA);
    vi.mocked(quodom.activosPorRubro).mockResolvedValue([]);
    vi.mocked(quodom.create).mockRejectedValue(new Error('network down'));

    renderEn('/quodom?rubro=7');
    await waitFor(() => expect(screen.getByText('Gaseosa 2L')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Cotizar por WhatsApp' }));

    await waitFor(() => expect(screen.getByText('No se pudo enviar.')).toBeInTheDocument());

    expect(openWhatsappLink).not.toHaveBeenCalled();
    // The guarantee this test exists to protect: a failed migration must
    // never drop the guest's cart.
    expect(getGuestCart(7).lines).toEqual([expect.objectContaining({ idproducto: 700, nombreProducto: 'Gaseosa 2L' })]);
  });
});

// Sin la medida el proveedor no puede cotizar, y sin dirección no sabe a quién
// le llega el pedido: las dos cosas frenan el envío, con el motivo a la vista.
describe('DetalleQuodom con el envío bloqueado', () => {
  beforeEach(() => {
    clearGuestQuodoms();
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({ user: USUARIO_LOGUEADO } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(categorias.raiz).mockResolvedValue(RUBROS_HABILITADOS);
    vi.mocked(users.getDirecciones).mockResolvedValue([{ id: 1 } as never]);
  });

  it('no deja enviar una línea sin el atributo elegido', async () => {
    addGuestLine(7, { ...GASEOSA, nombreAtributo1: 'LITROS' });

    renderEn('/quodom?rubro=7');
    await waitFor(() => expect(screen.getByText('Gaseosa 2L')).toBeInTheDocument());

    expect(screen.getByRole('button', { name: 'Cotizar por WhatsApp' })).toBeDisabled();
    expect(screen.getByText(/falta elegir la medida/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cotizar por WhatsApp' }));
    expect(quodom.whatsapp).not.toHaveBeenCalled();
  });

  it('deja enviar cuando el atributo está elegido', async () => {
    addGuestLine(7, { ...GASEOSA, nombreAtributo1: 'LITROS', atributo1: '2 litros' });
    vi.mocked(quodom.activosPorRubro).mockResolvedValue([]);
    vi.mocked(quodom.create).mockResolvedValue({ res: true, idquodom: 'Q-NEW' });
    vi.mocked(quodomLines.add).mockResolvedValue({ res: true, id: 1 });
    vi.mocked(quodom.whatsapp).mockResolvedValue({ res: true, link: 'https://wa.me/?text=ok' });

    renderEn('/quodom?rubro=7');
    await waitFor(() => expect(screen.getByText('Gaseosa 2L')).toBeInTheDocument());

    expect(screen.getByRole('button', { name: 'Cotizar por WhatsApp' })).toBeEnabled();
    expect(screen.queryByText(/falta elegir la medida/i)).toBeNull();
  });

  it('no deja enviar sin dirección cargada y ofrece el link para cargarla', async () => {
    vi.mocked(users.getDirecciones).mockResolvedValue([]);
    addGuestLine(7, GASEOSA);

    renderEn('/quodom?rubro=7');
    await waitFor(() => expect(screen.getByText('Gaseosa 2L')).toBeInTheDocument());

    await waitFor(() => expect(screen.getByRole('button', { name: 'Cotizar por WhatsApp' })).toBeDisabled());
    expect(screen.getByText(/falta tu dirección/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /cargar dirección/i })).toHaveAttribute('href', '/direcciones/nuevo');
  });
});

// El sidebar decide si puede enviar con `porccompletado`, que viene del
// servidor. Si elegir la medida acá no avisa, la tarjeta se queda mostrando
// "falta elegir la medida" sobre un Quodom que ya está completo.
describe('DetalleQuodom avisa al resto de la app', () => {
  beforeEach(() => {
    clearGuestQuodoms();
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({ user: null } as ReturnType<typeof useAuth>);
    vi.mocked(categorias.raiz).mockResolvedValue(RUBROS_HABILITADOS);
    vi.mocked(users.getDirecciones).mockResolvedValue([{ id: 1 } as never]);
    vi.mocked(quodomLines.atributos).mockResolvedValue([{ valoratributo: '2 litros' } as never]);
  });

  it('elegir un atributo dispara quodom:changed', async () => {
    const escuchado = vi.fn();
    window.addEventListener('quodom:changed', escuchado);
    addGuestLine(7, { ...GASEOSA, nombreAtributo1: 'LITROS' });

    renderEn('/quodom?rubro=7');
    await waitFor(() => expect(screen.getByText('Gaseosa 2L')).toBeInTheDocument());
    escuchado.mockClear();

    fireEvent.click(screen.getByRole('button', { name: /LITROS/ }));
    const opcion = await screen.findByRole('button', { name: '2 litros' });
    fireEvent.click(opcion);

    await waitFor(() => expect(escuchado).toHaveBeenCalled());
    window.removeEventListener('quodom:changed', escuchado);
  });
});

// Un usuario con sesión que cae en /quodom?rubro=X con el carrito de invitado
// ya vacío (migrado, p. ej. al ingresar) va al Quodom del servidor de ese
// rubro: el abierto si lo hay, y si no el más reciente.
describe('DetalleQuodom: carrito de invitado vacío con la sesión iniciada', () => {
  const LISTA = [
    { id: 'Q-RECIENTE', idrubro: 7 },
    { id: 'Q-ABIERTO', idrubro: 7 }
  ] as never;

  beforeEach(() => {
    clearGuestQuodoms();
    localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({ user: USUARIO_LOGUEADO } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(categorias.raiz).mockResolvedValue(RUBROS_HABILITADOS);
    vi.mocked(users.getDirecciones).mockResolvedValue([{ id: 1 } as never]);
    vi.mocked(quodom.porId).mockResolvedValue({ id: 'x', descripcion: 'x', estado: 'CREADO', idrubro: 7 } as never);
    vi.mocked(quodomLines.porQuodom).mockResolvedValue([]);
  });

  it('va al Quodom abierto del rubro, aunque haya otro más reciente', async () => {
    abrirQuodom(7, 'Q-ABIERTO');
    vi.mocked(quodom.activosPorRubro).mockResolvedValue(LISTA);

    renderEn('/quodom?rubro=7');

    await waitFor(() => expect(quodom.porId).toHaveBeenCalledWith('Q-ABIERTO'));
  });

  it('sin uno abierto va al más reciente', async () => {
    vi.mocked(quodom.activosPorRubro).mockResolvedValue(LISTA);

    renderEn('/quodom?rubro=7');

    await waitFor(() => expect(quodom.porId).toHaveBeenCalledWith('Q-RECIENTE'));
  });

  it('se queda donde está si el rubro no tiene ninguno', async () => {
    vi.mocked(quodom.activosPorRubro).mockResolvedValue([]);

    renderEn('/quodom?rubro=7');

    await waitFor(() => expect(quodom.activosPorRubro).toHaveBeenCalledWith(7));
    expect(quodom.porId).not.toHaveBeenCalled();
  });
});

// Enviar es elegir a quién: el botón abre el selector de proveedores, que es
// el que llama al endpoint. El camino de siempre —mandar sin destinatario y
// elegir adentro de WhatsApp— sigue estando, en el pie del selector.
describe('DetalleQuodom: el envío pasa por el selector de proveedores', () => {
  const QUODOM = {
    id: 'q-7', nro: 'QD-7', descripcion: 'Bebidas oficina', estado: 'CREADO', idrubro: 7
  };
  const LINEA = {
    id: 11, idquodom: 'q-7', idproducto: 700, cantidad: 2, nombreProducto: 'Gaseosa 2L'
  };

  beforeEach(() => {
    clearGuestQuodoms();
    localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({ user: USUARIO_LOGUEADO } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(categorias.raiz).mockResolvedValue(RUBROS_HABILITADOS);
    vi.mocked(users.getDirecciones).mockResolvedValue([{ id: 1 } as never]);
    vi.mocked(proveedores.delQuodom).mockResolvedValue(PROVEEDORES);
    vi.mocked(quodom.porId).mockResolvedValue(QUODOM as never);
    vi.mocked(quodomLines.porQuodom).mockResolvedValue([LINEA] as never);
  });

  it('tocar Cotizar abre el selector en vez de ir directo a WhatsApp', async () => {
    renderEn('/quodom?id=q-7');
    await waitFor(() => expect(screen.getByText('Gaseosa 2L')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Cotizar por WhatsApp' }));

    expect(await screen.findByText(/proveedores cerca/i)).toBeInTheDocument();
    expect(quodom.whatsapp).not.toHaveBeenCalled();
    expect(openWhatsappLink).not.toHaveBeenCalled();
  });

  it('el envío a un proveedor avisa al resto de la app', async () => {
    vi.mocked(quodom.whatsapp).mockResolvedValue({ res: true, link: 'https://wa.me/541166687854?text=ok' });
    const escuchado = vi.fn();
    window.addEventListener('quodom:changed', escuchado);

    renderEn('/quodom?id=q-7');
    await waitFor(() => expect(screen.getByText('Gaseosa 2L')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Cotizar por WhatsApp' }));
    fireEvent.click(await screen.findByRole('button', { name: /enviar por whatsapp/i }));

    await waitFor(() => expect(quodom.whatsapp).toHaveBeenCalledWith('q-7', { proveedor: 'p1', tel: '+541166687854' }));
    expect(openWhatsappLink).toHaveBeenCalledWith('https://wa.me/541166687854?text=ok');
    // Sin el aviso, el árbol y la barra inferior lo siguen mostrando en armado.
    await waitFor(() => expect(escuchado).toHaveBeenCalled());
    window.removeEventListener('quodom:changed', escuchado);
  });
});
