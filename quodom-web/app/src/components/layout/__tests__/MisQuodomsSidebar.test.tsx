import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MisQuodomsSidebar } from '../MisQuodomsSidebar';
import { quodom as quodomApi } from '../../../api/quodom';
import { useAuth } from '../../../auth/AuthContext';
import { addGuestLine, clearGuestQuodoms } from '../../../guest/guestQuodom';
import { rubrosDisponibles } from '../../../quodom/rubrosDisponibles';
import { leerAbiertos, abrirQuodom } from '../../../quodom/quodomAbierto';

// La campanita pide la cuenta al montar; sin esto sale un fetch real.
vi.mock('../../../api/oper_notificaciones', () => ({ notificaciones: { count: vi.fn(() => Promise.resolve(0)), list: vi.fn(() => Promise.resolve([])), marcarLeida: vi.fn() } }));
vi.mock('../../../api/quodom', () => ({
  quodom: { misQuodom: vi.fn(), repetir: vi.fn(), eliminar: vi.fn() }
}));
vi.mock('../../../auth/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../../../quodom/rubrosDisponibles', () => ({
  rubrosDisponibles: vi.fn(() => Promise.resolve([1, 2, 3, 4, 5, 6, 7, 8])),
  // setup.ts lo llama en cada beforeEach.
  reiniciarCacheRubros: vi.fn()
}));
// El sidebar pregunta si el usuario tiene dirección para saber si puede
// enviar. Sin mockearlo sale un fetch real que falla en tiempos distintos
// cada vez y vuelve intermitentes a los tests de al lado.
vi.mock('../../../api/users', () => ({ users: { getDirecciones: vi.fn(() => Promise.resolve([{ id: 1 }])) } }));

const misQuodom = quodomApi.misQuodom as unknown as ReturnType<typeof vi.fn>;
const GASEOSA = { idproducto: 700, nombreProducto: 'Gaseosa 2L', cantidad: 2 };

function login() {
  vi.mocked(useAuth).mockReturnValue({ user: { id: 'u-1' } } as unknown as ReturnType<typeof useAuth>);
}

function logout() {
  vi.mocked(useAuth).mockReturnValue({ user: null } as unknown as ReturnType<typeof useAuth>);
}

// Realistic, distinct descriptions: a user names their Quodom, they don't
// just retype the rubro name.
const BEBIDAS = { id: 'q-7', descripcion: 'Bebidas oficina', estado: 'CREADO', nro: 'QD-1', idrubro: 7, nombrerubro: 'Bebidas', cantproductos: 2, createdBy: 'u-1', iddireccion: null };
const OBRA = { id: 'q-4', descripcion: 'Obra San Isidro', estado: 'CREADO', nro: 'QD-2', idrubro: 4, nombrerubro: 'Construcción', cantproductos: 1, createdBy: 'u-1', iddireccion: null };

describe('MisQuodomsSidebar', () => {
  beforeEach(() => { misQuodom.mockReset(); clearGuestQuodoms(); localStorage.clear(); login(); });

  it('lists every open quodom with its rubro', async () => {
    misQuodom.mockResolvedValue([BEBIDAS, OBRA]);
    render(<MemoryRouter><MisQuodomsSidebar /></MemoryRouter>);

    await waitFor(() => expect(screen.getByText('Bebidas')).toBeInTheDocument());
    expect(screen.getByText('Construcción')).toBeInTheDocument();
    // The quodom's own name stays visible alongside its rubro label — it is
    // never hidden just because a user could type the rubro's name too.
    expect(screen.getByText('Bebidas oficina')).toBeInTheDocument();
    expect(screen.getByText('Obra San Isidro')).toBeInTheDocument();
  });

  it('reloads when quodom:changed fires', async () => {
    misQuodom.mockResolvedValue([BEBIDAS]);
    render(<MemoryRouter><MisQuodomsSidebar /></MemoryRouter>);
    await waitFor(() => expect(misQuodom).toHaveBeenCalledTimes(1));

    misQuodom.mockResolvedValue([BEBIDAS, OBRA]);
    act(() => { window.dispatchEvent(new Event('quodom:changed')); });

    await waitFor(() => expect(screen.getByText('Construcción')).toBeInTheDocument());
  });

  it('keeps showing the last-known-good list when a refresh fails', async () => {
    misQuodom.mockResolvedValue([BEBIDAS, OBRA]);
    render(<MemoryRouter><MisQuodomsSidebar /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText('Bebidas oficina')).toBeInTheDocument());

    misQuodom.mockRejectedValue(new Error('network down'));
    act(() => { window.dispatchEvent(new Event('quodom:changed')); });

    await waitFor(() => expect(misQuodom).toHaveBeenCalledTimes(2));
    // The previously loaded quodoms must still be on screen — a transient
    // refresh failure must not blank a sidebar that was showing correct data.
    expect(screen.getByText('Bebidas oficina')).toBeInTheDocument();
    expect(screen.getByText('Obra San Isidro')).toBeInTheDocument();
    expect(screen.queryByText(/Armá tu primer Quodom/i)).not.toBeInTheDocument();
  });
});

describe('MisQuodomsSidebar sin sesión', () => {
  beforeEach(() => { misQuodom.mockReset(); clearGuestQuodoms(); logout(); });

  it('lista los carritos de invitado con su rubro y la marca "sin guardar"', async () => {
    addGuestLine(7, GASEOSA);
    render(<MemoryRouter><MisQuodomsSidebar /></MemoryRouter>);

    expect(await screen.findByText('Bebidas')).toBeInTheDocument();
    expect(screen.getByText('Sin guardar')).toBeInTheDocument();
    // El carrito se dibuja como el Quodom que todavía no es: rótulo del rubro
    // más la tarjeta, igual que una rama del árbol.
    expect(screen.getByText('Carrito')).toBeInTheDocument();
    // Sin sesión no se le pide nada al servidor.
    expect(misQuodom).not.toHaveBeenCalled();
  });

  it('avisa que sólo viven en este navegador', async () => {
    addGuestLine(7, GASEOSA);
    render(<MemoryRouter><MisQuodomsSidebar /></MemoryRouter>);

    expect(await screen.findByText('Sin guardar')).toBeInTheDocument();
    expect(screen.getByText(/sólo en este navegador/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /ingresar para guardarlos/i })).toBeInTheDocument();
  });

  it('sin carritos muestra el mismo vacío que con sesión, más el link de ingresar', async () => {
    render(<MemoryRouter><MisQuodomsSidebar /></MemoryRouter>);

    expect(await screen.findByText(/Armá tu primer Quodom/i)).toBeInTheDocument();
    // Sin sesión ya se ven los carritos de invitado: "ingresá para ver tus
    // Quodoms" dejó de describir lo que hace el sidebar.
    expect(screen.queryByText(/Ingresá para ver tus Quodoms/i)).toBeNull();
    expect(screen.getByRole('link', { name: /ingresar/i })).toBeInTheDocument();
    expect(screen.queryByText('Sin guardar')).not.toBeInTheDocument();
  });

  it('se actualiza cuando cambia un carrito', async () => {
    render(<MemoryRouter><MisQuodomsSidebar /></MemoryRouter>);
    await screen.findByText(/Armá tu primer Quodom/i);

    act(() => {
      addGuestLine(1, { idproducto: 400, nombreProducto: 'Lavandina 1L', cantidad: 1 });
      window.dispatchEvent(new Event('quodom:changed'));
    });

    expect(await screen.findByText('Limpieza')).toBeInTheDocument();
  });
});

describe('MisQuodomsSidebar con sesión y carritos huérfanos', () => {
  beforeEach(() => { misQuodom.mockReset(); clearGuestQuodoms(); login(); });

  it('muestra los carritos sin guardar junto a los Quodoms del servidor', async () => {
    misQuodom.mockResolvedValue([BEBIDAS]);
    addGuestLine(1, { idproducto: 400, nombreProducto: 'Lavandina 1L', cantidad: 1 });
    render(<MemoryRouter><MisQuodomsSidebar /></MemoryRouter>);

    expect(await screen.findByText('Bebidas oficina')).toBeInTheDocument();
    expect(screen.getAllByText('Limpieza').length).toBeGreaterThan(0);
    expect(screen.getByText('Sin guardar')).toBeInTheDocument();
    // Ya está logueado: el aviso de "sólo en este navegador" no aplica.
    expect(screen.queryByText(/sólo en este navegador/i)).not.toBeInTheDocument();
  });
});

describe('sidebar: el árbol', () => {
  beforeEach(() => { misQuodom.mockReset(); clearGuestQuodoms(); localStorage.clear(); login(); });

  it('agrupa los Quodoms por rubro', async () => {
    misQuodom.mockResolvedValue([
      { id: 'p1', descripcion: 'Casa', estado: 'CREADO', nro: 'QD-1', idrubro: 5, nombrerubro: 'Pinturería', cantproductos: 2, porccompletado: 100 },
      { id: 'p2', descripcion: 'Depto', estado: 'CREADO', nro: 'QD-2', idrubro: 5, nombrerubro: 'Pinturería', cantproductos: 1, porccompletado: 100 },
      { id: 'l1', descripcion: 'Oficina', estado: 'CREADO', nro: 'QD-3', idrubro: 1, nombrerubro: 'Limpieza', cantproductos: 3, porccompletado: 100 }
    ]);

    render(<MemoryRouter><MisQuodomsSidebar /></MemoryRouter>);

    expect(await screen.findByRole('button', { name: /Casa/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Depto/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Oficina/ })).toBeInTheDocument();
  });

  it('no muestra los enviados: ésos viven en Mis Quodoms', async () => {
    misQuodom.mockResolvedValue([
      { id: 'p1', descripcion: 'Casa', estado: 'CREADO', nro: 'QD-1', idrubro: 5, cantproductos: 2, porccompletado: 100 },
      { id: 'p9', descripcion: 'Frente', estado: 'ENVIADO', nro: 'QD-9', idrubro: 5, cantproductos: 2, porccompletado: 100, fechaenvio: new Date().toISOString() }
    ]);

    render(<MemoryRouter><MisQuodomsSidebar /></MemoryRouter>);
    await screen.findByRole('button', { name: /Casa/ });

    expect(screen.queryByText(/Frente/)).toBeNull();
  });

  // Arriba y no al pie: al pie repetía el título del panel y se iba de pantalla
  // en cuanto la lista crecía, que es justo cuando hace falta.
  it('ofrece Ver historial en la cabecera, y ya no un botón al pie', async () => {
    misQuodom.mockResolvedValue([]);

    render(<MemoryRouter><MisQuodomsSidebar /></MemoryRouter>);

    // El panel muestra lo que está en armado; del otro lado del link está lo
    // ya enviado, así que el link nombra a dónde va.
    const ver = await screen.findByRole('link', { name: /ver historial/i });
    expect(ver).toHaveAttribute('href', '/mis-quodoms');
    expect(screen.queryByRole('link', { name: /^mis quodoms$/i })).toBeNull();
  });

  it('cuenta lo que hay en armado en la cabecera', async () => {
    misQuodom.mockResolvedValue([BEBIDAS, OBRA]);

    render(<MemoryRouter><MisQuodomsSidebar /></MemoryRouter>);

    expect(await screen.findByText('2 en armado · 2 rubros')).toBeInTheDocument();
  });

  it('ya no muestra Repetí un pedido', async () => {
    misQuodom.mockResolvedValue([
      { id: 'p9', descripcion: 'Frente', estado: 'ENVIADO', nro: 'QD-9', idrubro: 5, cantproductos: 2, porccompletado: 100, fechaenvio: new Date().toISOString() }
    ]);

    render(<MemoryRouter><MisQuodomsSidebar /></MemoryRouter>);
    await screen.findByRole('link', { name: /ver historial/i });

    expect(screen.queryByText(/repetí un pedido/i)).toBeNull();
  });

  it('no ofrece un rubro que ya no está disponible', async () => {
    vi.mocked(rubrosDisponibles).mockResolvedValueOnce([5]);
    misQuodom.mockResolvedValue([BEBIDAS, { ...OBRA, idrubro: 5, nombrerubro: 'Pintura' }]);

    render(<MemoryRouter><MisQuodomsSidebar /></MemoryRouter>);

    expect(await screen.findByText('Obra San Isidro')).toBeInTheDocument();
    expect(screen.queryByText('Bebidas oficina')).toBeNull();
  });
});

// sanearAbiertos descarta todo lo que no esté en la lista que recibe: llamarla
// con una lista que no salió de una carga buena cerraría los Quodoms abiertos.
describe('sidebar: saneo de los Quodoms abiertos', () => {
  beforeEach(() => { misQuodom.mockReset(); clearGuestQuodoms(); localStorage.clear(); login(); });

  it('descarta el abierto que ya no existe, tras una carga buena', async () => {
    abrirQuodom(7, 'q-fantasma');
    misQuodom.mockResolvedValue([BEBIDAS]);

    render(<MemoryRouter><MisQuodomsSidebar /></MemoryRouter>);
    await screen.findByText('Bebidas oficina');

    await waitFor(() => expect(leerAbiertos()).toEqual({}));
  });

  it('conserva los abiertos si la carga falla', async () => {
    abrirQuodom(7, 'q-7');
    misQuodom.mockRejectedValue(new Error('network down'));

    render(<MemoryRouter><MisQuodomsSidebar /></MemoryRouter>);
    await waitFor(() => expect(misQuodom).toHaveBeenCalled());
    await screen.findByRole('link', { name: /ver historial/i });

    expect(leerAbiertos()).toEqual({ 7: 'q-7' });
  });

  it('conserva los abiertos si no se pudo saber qué rubros hay', async () => {
    vi.mocked(rubrosDisponibles).mockRejectedValueOnce(new Error('sin red'));
    abrirQuodom(7, 'q-7');
    misQuodom.mockResolvedValue([BEBIDAS]);

    render(<MemoryRouter><MisQuodomsSidebar /></MemoryRouter>);
    await waitFor(() => expect(misQuodom).toHaveBeenCalled());
    await screen.findByRole('link', { name: /ver historial/i });

    expect(leerAbiertos()).toEqual({ 7: 'q-7' });
  });
});

// Los Quodoms son lo que el panel existe para mostrar; la lista de rubros es
// dato de referencia que sólo sirve para esconder los retirados.
describe('sidebar: degradar en vez de fallar', () => {
  beforeEach(() => { misQuodom.mockReset(); clearGuestQuodoms(); localStorage.clear(); login(); });

  it('si fallan las categorías, los Quodoms se muestran igual, sin filtrar', async () => {
    vi.mocked(rubrosDisponibles).mockRejectedValueOnce(new Error('categorias caídas'));
    misQuodom.mockResolvedValue([BEBIDAS, OBRA]);

    render(<MemoryRouter><MisQuodomsSidebar /></MemoryRouter>);

    expect(await screen.findByText('Bebidas oficina')).toBeInTheDocument();
    expect(screen.getByText('Obra San Isidro')).toBeInTheDocument();
    expect(screen.queryByText(/Armá tu primer Quodom/i)).toBeNull();
  });

  it('si fallan las categorías, un refresco igual actualiza la lista', async () => {
    misQuodom.mockResolvedValue([BEBIDAS]);
    render(<MemoryRouter><MisQuodomsSidebar /></MemoryRouter>);
    await screen.findByText('Bebidas oficina');

    vi.mocked(rubrosDisponibles).mockRejectedValueOnce(new Error('categorias caídas'));
    misQuodom.mockResolvedValue([]);
    act(() => { window.dispatchEvent(new Event('quodom:changed')); });

    await waitFor(() => expect(screen.queryByText('Bebidas oficina')).toBeNull());
  });

  it('si fallan los Quodoms, queda el estado de error de siempre y nada se sanea', async () => {
    abrirQuodom(7, 'q-7');
    misQuodom.mockRejectedValue(new Error('network down'));

    render(<MemoryRouter><MisQuodomsSidebar /></MemoryRouter>);

    expect(await screen.findByText(/Armá tu primer Quodom/i)).toBeInTheDocument();
    expect(leerAbiertos()).toEqual({ 7: 'q-7' });
  });
});

describe('sidebar: rubros sin Quodoms', () => {
  beforeEach(() => { misQuodom.mockReset(); clearGuestQuodoms(); localStorage.clear(); login(); });

  it('un usuario sin Quodoms igual puede soltar en el rubro del producto', async () => {
    misQuodom.mockResolvedValue([]);
    render(<MemoryRouter><MisQuodomsSidebar /></MemoryRouter>);
    await screen.findByText(/Armá tu primer Quodom/i);
    // Los ocho rubros están como ramas vacías; la zona para soltar aparece sólo
    // en el del producto que se arrastra.
    await waitFor(() => expect(document.querySelectorAll('[data-rubro-cab]')).toHaveLength(8));

    act(() => {
      window.dispatchEvent(new CustomEvent('arrastre:inicio', {
        detail: { idrubro: 5, nombre: 'Rodillo', nombreRubro: 'Pinturería' }
      }));
    });

    expect(document.querySelectorAll('[data-nuevo]')).toHaveLength(1);
    expect(document.querySelector('[data-nuevo="5"]')).toHaveAttribute('data-rubro', '5');
  });

  // El borde verde solo no explica la regla: el panel dice qué se arrastra y
  // a dónde puede ir.
  it('mientras se arrastra, el panel nombra el producto y su rubro', async () => {
    misQuodom.mockResolvedValue([]);
    render(<MemoryRouter><MisQuodomsSidebar /></MemoryRouter>);
    await screen.findByText(/Armá tu primer Quodom/i);

    act(() => {
      window.dispatchEvent(new CustomEvent('arrastre:inicio', {
        detail: { idrubro: 5, nombre: 'Rodillo lana 22 cm', nombreRubro: 'Pinturería' }
      }));
    });

    const aviso = screen.getByRole('status');
    expect(aviso).toHaveTextContent('Rodillo lana 22 cm');
    expect(aviso).toHaveTextContent(/Pinturería/);

    act(() => { window.dispatchEvent(new Event('arrastre:fin')); });
    expect(screen.queryByRole('status')).toBeNull();
  });
});

describe('MisQuodomsSidebar: panel cerrado', () => {
  beforeEach(() => {
    misQuodom.mockReset(); misQuodom.mockResolvedValue([]);
    clearGuestQuodoms(); localStorage.clear(); login();
    delete document.documentElement.dataset.panelCerrado;
  });

  // Cerrado queda sólo la pestaña de arriba; tocar "Mis Quodoms" lo abre al
  // ancho original.
  it('la pestaña "Mis Quodoms" abre el panel al ancho original', async () => {
    localStorage.setItem('quodom.anchoPanel', '500');
    localStorage.setItem('quodom.panelCerrado', '1');
    document.documentElement.dataset.panelCerrado = 'true';
    render(<MemoryRouter><MisQuodomsSidebar /></MemoryRouter>);

    fireEvent.click(screen.getByRole('button', { name: 'Abrir Mis Quodoms' }));

    expect(document.documentElement.dataset.panelCerrado).toBeUndefined();
    expect(localStorage.getItem('quodom.panelCerrado')).toBeNull();
    expect(localStorage.getItem('quodom.anchoPanel')).toBeNull();
  });
});

// Cerrado, al arrastrar aparece un destino chico debajo de la pestaña: el
// Quodom abierto del rubro del producto. El panel no se abre.
describe('MisQuodomsSidebar: soltar con el panel cerrado', () => {
  const CREADO = { id: 'q-7', descripcion: 'Bebidas oficina', estado: 'CREADO', nro: 'QD-7', idrubro: 7, nombrerubro: 'Bebidas', cantproductos: 2, createdBy: 'u-1', iddireccion: null };

  beforeEach(() => {
    misQuodom.mockReset(); misQuodom.mockResolvedValue([CREADO]);
    clearGuestQuodoms(); localStorage.clear(); login();
    localStorage.setItem('quodom.panelCerrado', '1');
    document.documentElement.dataset.panelCerrado = 'true';
  });

  function arrastrar() {
    act(() => {
      window.dispatchEvent(new CustomEvent('arrastre:inicio', { detail: { idrubro: 7, nombre: 'Coca Cola 2L', nombreRubro: 'Bebidas' } }));
    });
  }

  it('ofrece el Quodom abierto del rubro como destino', async () => {
    localStorage.setItem('quodom.abierto', JSON.stringify({ 7: 'q-7' }));
    const { container } = render(<MemoryRouter><MisQuodomsSidebar /></MemoryRouter>);
    await screen.findAllByText('Bebidas oficina');
    arrastrar();

    const destino = container.querySelector('.mq-sidebar-soltar') as HTMLElement;
    expect(destino).toHaveAttribute('data-destino', 'q-7');
    expect(destino).toHaveAttribute('data-rubro', '7');
    expect(destino).toHaveTextContent('Bebidas oficina');
    expect(document.documentElement.dataset.panelCerrado).toBe('true');
  });

  it('sin Quodom abierto en el rubro ofrece crear uno', async () => {
    const { container } = render(<MemoryRouter><MisQuodomsSidebar /></MemoryRouter>);
    await waitFor(() => expect(misQuodom).toHaveBeenCalled());
    arrastrar();

    const destino = container.querySelector('.mq-sidebar-soltar') as HTMLElement;
    expect(destino).toHaveAttribute('data-nuevo');
    expect(destino).toHaveAttribute('data-rubro', '7');
  });

  it('sin arrastrar no hay destino', async () => {
    const { container } = render(<MemoryRouter><MisQuodomsSidebar /></MemoryRouter>);
    await waitFor(() => expect(misQuodom).toHaveBeenCalled());
    expect(container.querySelector('.mq-sidebar-soltar')).toBeNull();
  });
});

describe('MisQuodomsSidebar: aviso de agregado con el panel cerrado', () => {
  const CREADO = { id: 'q-7', descripcion: 'Bebidas oficina', estado: 'CREADO', nro: 'QD-7', idrubro: 7, nombrerubro: 'Bebidas', cantproductos: 2, createdBy: 'u-1', iddireccion: null };

  beforeEach(() => {
    misQuodom.mockReset(); misQuodom.mockResolvedValue([CREADO]);
    clearGuestQuodoms(); localStorage.clear(); login();
    delete document.documentElement.dataset.panelCerrado;
  });

  function agregado() {
    act(() => {
      window.dispatchEvent(new CustomEvent('quodom:agregado', { detail: { nombre: 'Coca Cola 2L', idrubro: 7, idquodom: 'q-7' } }));
    });
  }

  it('cerrado, dice qué se agregó y adónde', async () => {
    localStorage.setItem('quodom.panelCerrado', '1');
    render(<MemoryRouter><MisQuodomsSidebar /></MemoryRouter>);
    await waitFor(() => expect(misQuodom).toHaveBeenCalled());
    await screen.findAllByText('Bebidas oficina');
    agregado();
    const aviso = screen.getByRole('status', { name: /agregado/i });
    expect(aviso).toHaveTextContent('Coca Cola 2L');
    expect(aviso).toHaveTextContent('Bebidas oficina');
  });

  // También abierto: la línea nueva aparece en el árbol, pero entre varios
  // rubros y Quodoms no se nota sola (lo pidió el usuario).
  it('abierto también avisa', async () => {
    render(<MemoryRouter><MisQuodomsSidebar /></MemoryRouter>);
    await waitFor(() => expect(misQuodom).toHaveBeenCalled());
    await screen.findAllByText('Bebidas oficina');
    agregado();
    expect(screen.getByRole('status', { name: /agregado/i })).toHaveTextContent('Coca Cola 2L');
  });
});
