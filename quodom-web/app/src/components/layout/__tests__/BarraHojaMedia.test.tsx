import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BarraQuodomInferior } from '../BarraQuodomInferior';
import { quodom as quodomApi } from '../../../api/quodom';
import { useAuth } from '../../../auth/AuthContext';
import { users as usersApi } from '../../../api/users';
import { abrirQuodom } from '../../../quodom/quodomAbierto';
import { quodomLines } from '../../../api/quodom_lines';
import { proveedores } from '../../../api/proveedores';
import { clearGuestQuodoms } from '../../../guest/guestQuodom';

vi.mock('../../../api/oper_notificaciones', () => ({ notificaciones: { count: vi.fn(() => Promise.resolve(0)), list: vi.fn(() => Promise.resolve([])), marcarLeida: vi.fn() } }));
vi.mock('../../../api/quodom', () => ({ quodom: { misQuodom: vi.fn(), whatsapp: vi.fn() } }));
vi.mock('../../../api/quodom_lines', () => ({
  quodomLines: { porQuodom: vi.fn().mockResolvedValue([]), update: vi.fn(), eliminar: vi.fn(), atributos: vi.fn() }
}));
vi.mock('../../../auth/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../../../quodom/rubrosDisponibles', () => ({
  rubrosDisponibles: vi.fn(() => Promise.resolve([1, 5, 7])),
  reiniciarCacheRubros: vi.fn()
}));
vi.mock('../../../api/users', () => ({ users: { getDirecciones: vi.fn() } }));
vi.mock('../../../api/proveedores', () => ({ proveedores: { delQuodom: vi.fn(), noEnviado: vi.fn() } }));

const CASA = { id: 'p1', descripcion: 'Casa', estado: 'CREADO', nro: 'QD-1', idrubro: 5, nombrerubro: 'Pinturería', cantproductos: 1, porccompletado: 100 };
const LATEX = { id: 11, idquodom: 'p1', idproducto: 137, cantidad: 1, nombreProducto: 'Latex Interior Blanco Mate' };

function montar(url = '/?rubro=5') {
  return render(<MemoryRouter initialEntries={[url]}><BarraQuodomInferior /></MemoryRouter>);
}
const toggle = () => screen.getByTestId('barra-toggle');
const hoja = () => within(screen.getByRole('region', { name: /Quodoms activos/i }));

beforeEach(() => {
  localStorage.clear();
  clearGuestQuodoms();
  vi.mocked(useAuth).mockReturnValue({ user: { id: 'u-1' } } as unknown as ReturnType<typeof useAuth>);
  vi.mocked(quodomApi.misQuodom).mockReset().mockResolvedValue([CASA] as never);
  vi.mocked(quodomLines.porQuodom).mockReset().mockResolvedValue([LATEX] as never);
  vi.mocked(usersApi.getDirecciones).mockReset().mockResolvedValue([{ id: 1 }] as never);
  vi.mocked(proveedores.delQuodom).mockReset().mockResolvedValue({ proveedores: [], preciso: true, desde: 'x', atribucion: 'Google' } as never);
  abrirQuodom(5, 'p1');
});

// En celular el árbol de la hoja es el mismo que el panel de escritorio, pero
// el Quodom abierto no mostraba nada: tocarlo lo marcaba y no se veían sus productos.
describe('la hoja de celular: el Quodom abierto', () => {
  it('muestra sus productos', async () => {
    montar();
    fireEvent.click(await screen.findByTestId('barra-toggle'));
    expect(await hoja().findByText('Latex Interior Blanco Mate')).toBeInTheDocument();
  });

  it('ofrece cotizar, y cotizar abre el selector de proveedores', async () => {
    montar();
    fireEvent.click(await screen.findByTestId('barra-toggle'));
    const cotizar = await hoja().findByRole('button', { name: /cotizar por whatsapp/i });
    await screen.findByText('Latex Interior Blanco Mate');

    fireEvent.click(cotizar);
    expect(await screen.findByText(/proveedores cerca/i)).toBeInTheDocument();
  });
});

describe('la hoja de celular: media pantalla', () => {
  // Abierta, el destino ya se ve en la tarjeta blanca; repetirlo en la barra
  // le resta lugar al catálogo.
  it('abierta, la barra no repite a qué Quodom suma', async () => {
    montar();
    expect(await screen.findByText(/sumando a/i)).toBeInTheDocument();

    fireEvent.click(toggle());
    expect(within(toggle()).queryByText(/sumando a/i)).toBeNull();
  });

  // La mitad de arriba es para usar el catálogo con la hoja abierta: tocar un
  // producto o un `+` no puede cerrarla.
  it('tocar afuera no la cierra', async () => {
    montar();
    fireEvent.click(await screen.findByTestId('barra-toggle'));

    fireEvent.pointerDown(document.body);
    fireEvent.click(document.body);
    expect(toggle()).toHaveAttribute('aria-expanded', 'true');
  });

  // La manija de arriba sólo servía para deslizarla: tocarla no hacía nada, y
  // es justo donde el dedo va a cerrar.
  it('tocar la manija de arriba la cierra', async () => {
    montar();
    fireEvent.click(await screen.findByTestId('barra-toggle'));
    fireEvent.click(screen.getByTestId('barra-manija'));
    expect(toggle()).toHaveAttribute('aria-expanded', 'false');
  });

  it('la flecha la cierra', async () => {
    montar();
    fireEvent.click(await screen.findByTestId('barra-toggle'));
    fireEvent.click(toggle());
    expect(toggle()).toHaveAttribute('aria-expanded', 'false');
  });
});

// Al abrirla la página se acomoda para que las subcategorías queden arriba,
// debajo del nav: con la hoja ocupando el 40% de abajo, lo que queda a la vista
// tiene que ser lo que se usa para buscar (las pestañas y los productos).
describe('la hoja de celular: abrirla acomoda el catálogo', () => {
  function subtabsEn(top: number) {
    const el = document.createElement('nav');
    el.className = 'subtabs';
    el.getBoundingClientRect = () => ({ top, bottom: top + 40, left: 0, right: 390, width: 390, height: 40, x: 0, y: top, toJSON() {} });
    document.body.appendChild(el);
    return el;
  }

  it('lleva las subcategorías arriba de todo', async () => {
    const tabs = subtabsEn(500);
    const scroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    montar();
    fireEvent.click(await screen.findByTestId('barra-toggle'));

    expect(scroll).toHaveBeenCalledWith(expect.objectContaining({ top: 492 }));
    tabs.remove();
    scroll.mockRestore();
  });

  it('sin subcategorías en pantalla no mueve nada', async () => {
    const scroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    montar();
    fireEvent.click(await screen.findByTestId('barra-toggle'));

    expect(scroll).not.toHaveBeenCalled();
    scroll.mockRestore();
  });

  it('cerrarla no mueve nada', async () => {
    const tabs = subtabsEn(500);
    montar();
    fireEvent.click(await screen.findByTestId('barra-toggle'));
    const scroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    fireEvent.click(toggle());

    expect(scroll).not.toHaveBeenCalled();
    tabs.remove();
    scroll.mockRestore();
  });
});
