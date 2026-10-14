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

  it('el botón de enviar dice cotizar por WhatsApp', () => {
    montar({ onEnviar: vi.fn() });

    expect(screen.getByRole('button', { name: 'Cotizar por WhatsApp' })).toBeInTheDocument();
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

// La dirección define a qué proveedores llega el pedido y la medida es lo que
// el proveedor necesita para cotizar: sin eso el envío se bloquea, y el motivo
// tiene que estar a la vista y ser accionable, no un botón muerto.
describe('QuodomCard con el envío bloqueado', () => {
  it('deshabilita enviar y muestra el motivo', () => {
    montar({
      onEnviar: vi.fn(),
      bloqueo: { motivo: 'atributo', texto: 'Falta elegir la medida de algún producto.', accion: 'Abrí el Quodom y completá lo que falta.' }
    });

    expect(screen.getByRole('button', { name: 'Cotizar por WhatsApp' })).toBeDisabled();
    expect(screen.getByText(/falta elegir la medida/i)).toBeInTheDocument();
  });

  it('no llama a enviar cuando está bloqueado', () => {
    const onEnviar = vi.fn();
    montar({
      onEnviar,
      bloqueo: { motivo: 'direccion', texto: 'Falta tu dirección.', accion: 'Cargar dirección' }
    });

    fireEvent.click(screen.getByRole('button', { name: 'Cotizar por WhatsApp' }));

    expect(onEnviar).not.toHaveBeenCalled();
  });

  it('ofrece el link para cargar la dirección que falta', () => {
    montar({
      onEnviar: vi.fn(),
      bloqueo: { motivo: 'direccion', texto: 'Falta tu dirección.', accion: 'Cargar dirección' }
    });

    expect(screen.getByRole('link', { name: /cargar dirección/i })).toHaveAttribute('href', '/direcciones/nuevo');
  });

  it('sin bloqueo el botón funciona como siempre', () => {
    const onEnviar = vi.fn();
    montar({ onEnviar, bloqueo: null });

    fireEvent.click(screen.getByRole('button', { name: 'Cotizar por WhatsApp' }));

    expect(onEnviar).toHaveBeenCalled();
  });
});
