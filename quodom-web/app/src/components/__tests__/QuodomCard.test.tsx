import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { QuodomCard } from '../QuodomCard';
import { quodom as quodomApi } from '../../api/quodom';
import type { Quodom } from '../../api/types';

vi.mock('../../api/quodom', () => ({
  quodom: { update: vi.fn(), eliminar: vi.fn(), repetir: vi.fn(), whatsapp: vi.fn() }
}));

const update = quodomApi.update as unknown as ReturnType<typeof vi.fn>;

const BEBIDAS = {
  id: 'q-7', descripcion: 'Bebidas oficina', estado: 'CREADO', nro: 'QD-7',
  idrubro: 7, nombrerubro: 'Bebidas', cantproductos: 3, porccompletado: 66,
  createdBy: 'u-1', iddireccion: null
} as unknown as Quodom;

function Espia() {
  const l = useLocation();
  return <div data-testid="url">{l.pathname + l.search}</div>;
}

function montar(props: Partial<Parameters<typeof QuodomCard>[0]> = {}) {
  return render(
    <MemoryRouter initialEntries={['/inicio']}>
      <Routes>
        <Route path="/inicio" element={<QuodomCard quodom={BEBIDAS} variant="sidebar" rubroLabel="Bebidas" {...props} />} />
        <Route path="/" element={<Espia />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  update.mockReset();
  update.mockResolvedValue(BEBIDAS);
});

describe('QuodomCard', () => {
  // La tarjeta no envía. El `enviable` que abría el selector acá adentro lo
  // pasaba únicamente este test, así que el botón no se renderizaba nunca en
  // producción; y el montaje ponía el diálogo DENTRO de la tarjeta, que es lo
  // que `MisQuodomsSidebar` se reestructuró para evitar — en Mis Quodoms el
  // refresco de después del envío desmonta la tarjeta y cierra el diálogo a
  // mitad del flujo. Esta aserción es para que no vuelva a aparecer sin que
  // alguien resuelva eso.
  it('no ofrece enviar: los caminos que envían son el árbol y el detalle', () => {
    montar();

    expect(screen.queryByRole('button', { name: /cotizar/i })).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('no muestra el porcentaje de completado', () => {
    montar();

    expect(screen.getByText(/3 productos/)).toBeInTheDocument();
    expect(screen.queryByText(/completo/i)).toBeNull();
    expect(screen.queryByText(/66/)).toBeNull();
  });

  it('Continuar lleva al rubro del Quodom en el inicio', async () => {
    montar();

    fireEvent.click(screen.getByRole('button', { name: /continuar/i }));

    // Continuar es "seguir agregando productos de este rubro", no "abrir la
    // ficha": el catálogo de ese rubro es lo que hace falta a continuación.
    expect(await screen.findByTestId('url')).toHaveTextContent('/?rubro=7');
  });

  it('el menú ya no ofrece Cancelar', () => {
    montar();

    fireEvent.click(screen.getByRole('button', { name: /acciones/i }));

    expect(screen.getByRole('button', { name: /eliminar/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^cancelar$/i })).toBeNull();
  });

  it('cambiar nombre guarda la descripción nueva', async () => {
    const onChange = vi.fn();
    montar({ onChange });

    fireEvent.click(screen.getByRole('button', { name: /acciones/i }));
    fireEvent.click(screen.getByRole('button', { name: /cambiar nombre/i }));

    const input = screen.getByRole('textbox', { name: /nombre del quodom/i });
    fireEvent.change(input, { target: { value: 'Bebidas del viernes' } });
    fireEvent.submit(input.closest('form') as HTMLFormElement);

    await waitFor(() => expect(update).toHaveBeenCalledWith('q-7', { descripcion: 'Bebidas del viernes' }));
    expect(onChange).toHaveBeenCalled();
  });

  it('Escape cancela el cambio de nombre sin guardar', async () => {
    montar();

    fireEvent.click(screen.getByRole('button', { name: /acciones/i }));
    fireEvent.click(screen.getByRole('button', { name: /cambiar nombre/i }));

    const input = screen.getByRole('textbox', { name: /nombre del quodom/i });
    fireEvent.change(input, { target: { value: 'otro nombre' } });
    fireEvent.keyDown(input, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('textbox')).toBeNull());
    expect(update).not.toHaveBeenCalled();
    expect(screen.getByText('Bebidas oficina')).toBeInTheDocument();
  });

  // Antes sólo Enter guardaba, y tocar afuera dejaba el campo abierto.
  it('salir del campo guarda el nombre, igual que Enter', async () => {
    const onChange = vi.fn();
    montar({ onChange });

    fireEvent.click(screen.getByRole('button', { name: /acciones/i }));
    fireEvent.click(screen.getByRole('button', { name: /cambiar nombre/i }));

    const input = screen.getByRole('textbox', { name: /nombre del quodom/i });
    fireEvent.change(input, { target: { value: 'Bebidas del viernes' } });
    fireEvent.blur(input);

    await waitFor(() => expect(update).toHaveBeenCalledWith('q-7', { descripcion: 'Bebidas del viernes' }));
    await waitFor(() => expect(screen.queryByRole('textbox')).toBeNull());
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('Escape no guarda aunque después llegue el blur', async () => {
    montar();
    fireEvent.click(screen.getByRole('button', { name: /acciones/i }));
    fireEvent.click(screen.getByRole('button', { name: /cambiar nombre/i }));

    const input = screen.getByRole('textbox', { name: /nombre del quodom/i });
    fireEvent.change(input, { target: { value: 'otro nombre' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    fireEvent.blur(input);

    await waitFor(() => expect(screen.queryByRole('textbox')).toBeNull());
    expect(update).not.toHaveBeenCalled();
  });

  it('tocar afuera cierra el menú sin abrir el pedido', () => {
    const onAbrir = vi.fn();
    montar({ onAbrir });

    fireEvent.click(screen.getByRole('button', { name: /acciones/i }));
    expect(screen.getByRole('button', { name: /eliminar/i })).toBeInTheDocument();

    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('button', { name: /eliminar/i })).toBeNull();
    expect(onAbrir).not.toHaveBeenCalled();
  });

  it('tocar la tarjeta con el menú abierto lo cierra en vez de abrir el pedido', () => {
    const onAbrir = vi.fn();
    montar({ onAbrir });

    fireEvent.click(screen.getByRole('button', { name: /acciones/i }));
    fireEvent.click(screen.getByRole('button', { name: /QD-7/ }));

    expect(screen.queryByRole('button', { name: /eliminar/i })).toBeNull();
    expect(onAbrir).not.toHaveBeenCalled();
  });

  // El proveedor cotiza sobre lo que recibió, con ese nombre.
  it('un enviado no ofrece cambiar el nombre', () => {
    montar({ quodom: { ...BEBIDAS, estado: 'ENVIADO', fechaenvio: new Date(Date.now() - 60 * 60 * 1000).toISOString() } as unknown as Quodom });

    fireEvent.click(screen.getByRole('button', { name: /acciones/i }));
    expect(screen.queryByRole('button', { name: /cambiar nombre/i })).toBeNull();
  });

  it('un nombre vacío no se guarda', async () => {
    montar();

    fireEvent.click(screen.getByRole('button', { name: /acciones/i }));
    fireEvent.click(screen.getByRole('button', { name: /cambiar nombre/i }));

    const input = screen.getByRole('textbox', { name: /nombre del quodom/i });
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.submit(input.closest('form') as HTMLFormElement);

    await waitFor(() => expect(screen.queryByRole('textbox')).toBeNull());
    expect(update).not.toHaveBeenCalled();
  });
});

// Un pedido enviado dice ENVIADO para siempre.
//
// La tarjeta tenia un tercer estado, VENCIDO, que aparecia a las 72hs de
// enviado: "Pasaron las 72hs y se vencio tu pedido". Es herencia de Quodom
// 1.0, donde los vendedores tenian ese plazo para cotizar. En este producto no
// hay vendedores ni cotizaciones y **nada vence**: el pedido sale por WhatsApp
// y el proveedor contesta cuando puede. VENCIDO no existia en el backend ni en
// el contrato, solo en este archivo, asi que a los tres dias el pedido se leia
// como fracasado sin que nada hubiera fracasado.
describe('QuodomCard: un enviado no vence', () => {
  const haceDias = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();

  const enviadoHace = (dias: number) => ({
    ...BEBIDAS, estado: 'ENVIADO', fechaenvio: haceDias(dias)
  }) as unknown as Quodom;

  it('dice ENVIADO recien salido', () => {
    montar({ quodom: enviadoHace(0) });
    expect(screen.getByText('ENVIADO')).toBeInTheDocument();
  });

  it('sigue diciendo ENVIADO una semana despues, y nunca VENCIDO', () => {
    montar({ quodom: enviadoHace(7) });
    expect(screen.getByText('ENVIADO')).toBeInTheDocument();
    expect(screen.queryByText(/vencido/i)).toBeNull();
    expect(screen.queryByText(/72hs/i)).toBeNull();
  });
});

// Repetir devuelve un Quodom al árbol: si el panel estaba cerrado, se abre,
// igual que desde la notificación y desde la ventana del pedido.
describe('QuodomCard: repetir abre el panel', () => {
  const repetir = quodomApi.repetir as unknown as ReturnType<typeof vi.fn>;
  const ENVIADO = {
    ...BEBIDAS, estado: 'ENVIADO', fechaenvio: new Date(Date.now() - 60 * 60 * 1000).toISOString()
  } as unknown as Quodom;

  it('abre el panel si estaba cerrado', async () => {
    localStorage.setItem('quodom.panelCerrado', '1');
    document.documentElement.dataset.panelCerrado = 'true';
    repetir.mockResolvedValue({ res: true, idquodom: 'q-nuevo' });
    montar({ quodom: ENVIADO, variant: 'page' });

    fireEvent.click(screen.getByRole('button', { name: /repetir/i }));

    await waitFor(() => expect(document.documentElement.dataset.panelCerrado).toBeUndefined());
    expect(localStorage.getItem('quodom.panelCerrado')).toBeNull();
  });
});
