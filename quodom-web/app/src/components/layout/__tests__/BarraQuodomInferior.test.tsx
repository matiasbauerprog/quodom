import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BarraQuodomInferior } from '../BarraQuodomInferior';
import { quodom as quodomApi } from '../../../api/quodom';
import { useAuth } from '../../../auth/AuthContext';
import { addGuestLine, clearGuestQuodoms } from '../../../guest/guestQuodom';
import { abrirQuodom } from '../../../quodom/quodomAbierto';
import { rubrosDisponibles } from '../../../quodom/rubrosDisponibles';

// La campanita pide la cuenta al montar; sin esto sale un fetch real.
vi.mock('../../../api/oper_notificaciones', () => ({ notificaciones: { count: vi.fn(() => Promise.resolve(0)), list: vi.fn(() => Promise.resolve([])), marcarLeida: vi.fn() } }));
vi.mock('../../../api/quodom', () => ({ quodom: { misQuodom: vi.fn() } }));
vi.mock('../../../auth/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../../../quodom/rubrosDisponibles', () => ({
  rubrosDisponibles: vi.fn(),
  reiniciarCacheRubros: vi.fn()
}));

const misQuodom = quodomApi.misQuodom as unknown as ReturnType<typeof vi.fn>;
// Distinct from its own rubro name: a real Quodom's descripcion and its rubro
// label are two different pieces of text on screen.
const BEBIDAS = { id: 'q-7', descripcion: 'Bebidas oficina', estado: 'CREADO', nro: 'QD-1', idrubro: 7, nombrerubro: 'Bebidas', cantproductos: 2, createdBy: 'u-1', iddireccion: null };
const OBRA = { id: 'q-4', descripcion: 'Obra', estado: 'CREADO', nro: 'QD-2', idrubro: 4, nombrerubro: 'Construcción', cantproductos: 1, createdBy: 'u-1', iddireccion: null };
const CASA = { id: 'p1', descripcion: 'Casa', estado: 'CREADO', nro: 'QD-1', idrubro: 5, nombrerubro: 'Pinturería', cantproductos: 2, porccompletado: 100 };
const DEPTO = { id: 'p2', descripcion: 'Depto', estado: 'CREADO', nro: 'QD-5', idrubro: 5, nombrerubro: 'Pinturería', cantproductos: 1, porccompletado: 100 };
const OFICINA = { id: 'l1', descripcion: 'Oficina', estado: 'CREADO', nro: 'QD-3', idrubro: 1, nombrerubro: 'Limpieza', cantproductos: 3, porccompletado: 100 };
const GASEOSA = { idproducto: 700, nombreProducto: 'Gaseosa 2L', cantidad: 2 };

function login() {
  vi.mocked(useAuth).mockReturnValue({ user: { id: 'u-1' } } as unknown as ReturnType<typeof useAuth>);
}

function logout() {
  vi.mocked(useAuth).mockReturnValue({ user: null } as unknown as ReturnType<typeof useAuth>);
}

// El árbol desplegado, aparte del botón de la barra, cuyo texto también nombra el destino.
const arbol = () => within(screen.getByRole('region', { name: /Quodoms activos/i }));

function montar(url = '/') {
  return render(<MemoryRouter initialEntries={[url]}><BarraQuodomInferior /></MemoryRouter>);
}

const toggle = () => screen.getByTestId('barra-toggle');
const findToggle = () => screen.findByTestId('barra-toggle');

function reiniciar() {
  misQuodom.mockReset();
  localStorage.clear();
  clearGuestQuodoms();
  vi.mocked(rubrosDisponibles).mockResolvedValue([1, 4, 5, 7]);
}

describe('BarraQuodomInferior', () => {
  beforeEach(() => {
    reiniciar();
    login();
  });

  // Es la única entrada al panel en celular: esconderla justo cuando no hay nada
  // deja al que recién llega sin ver que el panel existe.
  it('sin Quodoms sigue estando, y lo dice', async () => {
    misQuodom.mockResolvedValue([]);
    montar();

    expect(await screen.findByText(/ningún quodom en armado/i)).toBeInTheDocument();
    expect(screen.getByTestId('barra-toggle')).toBeInTheDocument();
  });

  it('sin Quodoms el panel ofrece los tres pasos', async () => {
    misQuodom.mockResolvedValue([]);
    montar();

    fireEvent.click(await findToggle());

    expect(screen.getByText(/armá tu primer quodom/i)).toBeInTheDocument();
  });

  it('no parpadea: espera la primera respuesta antes de mostrarse', () => {
    misQuodom.mockReturnValue(new Promise(() => {}));
    const { container } = montar();

    expect(container.querySelector('.barra-quodom')).toBeNull();
  });

  it('shows the number of quodoms in armado, collapsed', async () => {
    misQuodom.mockResolvedValue([BEBIDAS, OBRA]);
    montar();

    expect(await screen.findByText('2')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Bebidas oficina/ })).toBeNull();
  });

  it('expands the tree on click and lists each open quodom', async () => {
    misQuodom.mockResolvedValue([BEBIDAS, OBRA]);
    montar();

    fireEvent.click(await findToggle());

    expect(screen.getByRole('button', { name: /Bebidas oficina/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Obra/ })).toBeInTheDocument();
  });

  it('collapses again on a second click', async () => {
    misQuodom.mockResolvedValue([BEBIDAS]);
    montar();

    await findToggle();
    fireEvent.click(toggle());
    expect(screen.getByRole('button', { name: /Bebidas oficina/ })).toBeInTheDocument();
    fireEvent.click(toggle());

    expect(screen.queryByRole('button', { name: /Bebidas oficina/ })).toBeNull();
  });

  it('refreshes the list when quodom:changed fires', async () => {
    misQuodom.mockResolvedValue([BEBIDAS]);
    montar();
    await waitFor(() => expect(misQuodom).toHaveBeenCalledTimes(1));

    misQuodom.mockResolvedValue([BEBIDAS, OBRA]);
    act(() => { window.dispatchEvent(new Event('quodom:changed')); });

    await waitFor(() => expect(screen.getByText('2')).toBeInTheDocument());
  });

  it('lists a leftover guest cart alongside the logged-in user\'s server quodoms', async () => {
    // Spec §6: a declined ('cancelar') migration leaves the guest cart intact
    // in localStorage. Without this it becomes unreachable once logged in.
    addGuestLine(4, { idproducto: 400, nombreProducto: 'Cemento 50kg', cantidad: 1 });
    misQuodom.mockResolvedValue([BEBIDAS]);
    montar();
    await waitFor(() => expect(screen.getByText('2')).toBeInTheDocument()); // 1 server + 1 guest

    fireEvent.click(toggle());

    expect(screen.getByRole('button', { name: /Bebidas oficina/ })).toBeInTheDocument();
    expect(screen.getByText(/sin guardar/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Construcción/ })).toHaveAttribute('href', '/quodom?rubro=4');
  });
});

describe('BarraQuodomInferior tree', () => {
  beforeEach(() => {
    reiniciar();
    login();
  });

  it('dice a qué Quodom suma el rubro que está en pantalla', async () => {
    abrirQuodom(5, 'p1');
    misQuodom.mockResolvedValue([CASA, DEPTO]);

    montar('/?rubro=5');

    expect(await screen.findByText(/sumando a/i)).toBeInTheDocument();
    expect(screen.getByText('Casa')).toBeInTheDocument();
  });

  // El defecto que esto arregla: la barra listaba el abierto de TODOS los
  // rubros, así que navegando Pintura decía "Sumando a: Limpieza · Oficina"
  // todo el tiempo. Cierto, y la respuesta a una pregunta que nadie hizo.
  it('el Quodom abierto de otro rubro no aparece', async () => {
    abrirQuodom(1, 'l1');
    misQuodom.mockResolvedValue([OFICINA]);

    montar('/?rubro=5');

    await screen.findByTestId('barra-toggle');
    expect(screen.getByTestId('barra-toggle')).not.toHaveTextContent('Oficina');
    expect(screen.getByTestId('barra-toggle')).not.toHaveTextContent(/sumando a/i);
  });

  it('en un rubro sin destino dice que se elige al agregar', async () => {
    misQuodom.mockResolvedValue([CASA, DEPTO]);

    montar('/?rubro=5');

    expect(await screen.findByText(/elegís el Quodom al agregar/i)).toBeInTheDocument();
    expect(screen.getByTestId('barra-toggle')).toHaveTextContent('Pinturería');
  });

  // Fuera de un rubro no hay un destino que nombrar: lo que queda por decir es
  // cuánto hay en armado.
  it('fuera de un rubro cuenta lo que hay en armado', async () => {
    abrirQuodom(1, 'l1');
    misQuodom.mockResolvedValue([OFICINA, CASA]);

    montar();

    expect(await screen.findByText(/2 Quodoms en armado/i)).toBeInTheDocument();
  });

  it('al desplegarla aparece el mismo árbol', async () => {
    misQuodom.mockResolvedValue([CASA]);

    montar();
    fireEvent.click(await findToggle());

    expect(arbol().getByRole('button', { name: /Casa/ })).toBeInTheDocument();
  });

  it('con uno abierto, la barra lo nombra y el árbol lo muestra', async () => {
    abrirQuodom(5, 'p1');
    misQuodom.mockResolvedValue([CASA, DEPTO]);

    montar('/?rubro=5');
    fireEvent.click(await screen.findByRole('button', { name: /sumando a/i }));

    expect(arbol().getByRole('button', { name: /Casa/ })).toBeInTheDocument();
  });
});

describe('BarraQuodomInferior for guests', () => {
  beforeEach(() => {
    reiniciar();
    logout();
  });

  it('sin carritos sigue estando, con los tres pasos y el link de ingresar', async () => {
    montar();

    fireEvent.click(await findToggle());

    expect(screen.getByText(/armá tu primer quodom/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /ingresar/i })).toBeInTheDocument();
    // Sin sesión no se le pide nada al servidor.
    expect(misQuodom).not.toHaveBeenCalled();
  });

  it('shows the count of guest carts with lines and expands to list them', async () => {
    addGuestLine(7, GASEOSA);
    addGuestLine(4, { idproducto: 400, nombreProducto: 'Cemento 50kg', cantidad: 1 });
    montar();

    expect(await screen.findByText('2')).toBeInTheDocument();

    fireEvent.click(toggle());

    expect(screen.getByRole('link', { name: /Bebidas/ })).toHaveAttribute('href', '/quodom?rubro=7');
    expect(screen.getByRole('link', { name: /Construcción/ })).toHaveAttribute('href', '/quodom?rubro=4');
  });

  it('refreshes on quodom:changed as a guest adds a product', async () => {
    montar();
    expect(await screen.findByText(/ningún quodom en armado/i)).toBeInTheDocument();

    addGuestLine(7, GASEOSA);
    act(() => { window.dispatchEvent(new Event('quodom:changed')); });

    await waitFor(() => expect(screen.getByText('1')).toBeInTheDocument());
  });
});

// En celular la barra es lo que en escritorio es el panel oculto: dice adónde
// soltar mientras se arrastra y avisa lo que entró.
describe('BarraQuodomInferior · como el panel oculto', () => {
  const ARRASTRE = { idrubro: 5, nombre: 'Latex', nombreRubro: 'Pintura' };
  const empezar = () => act(() => { window.dispatchEvent(new CustomEvent('arrastre:inicio', { detail: ARRASTRE })); });
  const terminar = () => act(() => { window.dispatchEvent(new Event('arrastre:fin')); });

  beforeEach(() => {
    reiniciar();
    login();
    misQuodom.mockResolvedValue([CASA, DEPTO]);
  });
  afterEach(() => {
    terminar();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('mientras se arrastra muestra dónde soltar', async () => {
    abrirQuodom(5, 'p1');
    montar('/?rubro=5');
    await findToggle();
    empezar();

    const destino = document.querySelector('.barra-quodom-soltar[data-destino="p1"][data-rubro="5"]');
    expect(destino).not.toBeNull();
    expect(destino).toHaveTextContent('Soltá para sumar a Casa');
  });

  it('sin abierto en el rubro ofrece un Quodom nuevo', async () => {
    montar('/?rubro=5');
    await findToggle();
    empezar();

    expect(document.querySelector('.barra-quodom-soltar[data-nuevo="5"]')).not.toBeNull();
  });

  // La barra existe también en escritorio, escondida por CSS: un segundo
  // destino ahí duplicaría el de la pestaña del panel cerrado.
  it('en escritorio no monta el destino', async () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: false, addEventListener: () => {}, removeEventListener: () => {}
    } as unknown as MediaQueryList);
    abrirQuodom(5, 'p1');
    montar('/?rubro=5');
    await findToggle();
    empezar();

    expect(document.querySelector('.barra-quodom-soltar')).toBeNull();
  });

  it('avisa lo que se agregó', async () => {
    montar('/?rubro=5');
    await findToggle();
    act(() => {
      window.dispatchEvent(new CustomEvent('quodom:agregado', { detail: { nombre: 'Latex', idrubro: 5, idquodom: 'p1' } }));
    });

    expect(screen.getByRole('status')).toHaveTextContent('Latex agregado a Casa');
  });

  it('tocar afuera la cierra', async () => {
    montar();
    fireEvent.click(await findToggle());
    expect(toggle()).toHaveAttribute('aria-expanded', 'true');

    fireEvent.pointerDown(document.body);
    expect(toggle()).toHaveAttribute('aria-expanded', 'false');
  });

  it('la hoja que abrió el arrastre se cierra al terminar', async () => {
    montar('/?rubro=5');
    await findToggle();
    vi.spyOn(document, 'elementFromPoint').mockReturnValue(toggle());
    vi.useFakeTimers();
    empezar();
    act(() => { window.dispatchEvent(new PointerEvent('pointermove', { clientX: 100, clientY: 780 })); });
    act(() => { vi.advanceTimersByTime(800); });
    expect(toggle()).toHaveAttribute('aria-expanded', 'true');

    terminar();
    expect(toggle()).toHaveAttribute('aria-expanded', 'false');
  });

  it('pasar de largo sobre la barra no la abre', async () => {
    montar('/?rubro=5');
    await findToggle();
    const elementFromPoint = vi.spyOn(document, 'elementFromPoint').mockReturnValue(toggle());
    vi.useFakeTimers();
    empezar();
    act(() => { window.dispatchEvent(new PointerEvent('pointermove', { clientX: 100, clientY: 780 })); });
    act(() => { vi.advanceTimersByTime(300); });
    elementFromPoint.mockReturnValue(document.body);
    act(() => { window.dispatchEvent(new PointerEvent('pointermove', { clientX: 100, clientY: 300 })); });
    act(() => { vi.advanceTimersByTime(1000); });

    expect(toggle()).toHaveAttribute('aria-expanded', 'false');
  });

  it('la que abrió el usuario se queda abierta', async () => {
    montar('/?rubro=5');
    fireEvent.click(await findToggle());
    empezar();
    terminar();

    expect(toggle()).toHaveAttribute('aria-expanded', 'true');
  });
});
