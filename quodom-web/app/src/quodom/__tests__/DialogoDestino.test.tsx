import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DialogoDestino } from '../DialogoDestino';
import type { Quodom } from '../../api/types';

const CASA = { id: 'q-casa', descripcion: 'Casa', cantproductos: 3, idrubro: 5 } as unknown as Quodom;
const DEPTO = { id: 'q-depto', descripcion: 'Depto', cantproductos: 1, idrubro: 5 } as unknown as Quodom;

function montar(extra: Partial<Parameters<typeof DialogoDestino>[0]> = {}) {
  const props = {
    nombreRubro: 'Pintura', candidatos: [CASA, DEPTO],
    onElegir: vi.fn(), onCrear: vi.fn(), onCancelar: vi.fn(), ...extra
  };
  render(<DialogoDestino {...props} />);
  return props;
}

describe('DialogoDestino', () => {
  it('elige un Quodom existente', () => {
    const p = montar();
    fireEvent.click(screen.getByRole('button', { name: /depto/i }));
    expect(p.onElegir).toHaveBeenCalledWith('q-depto');
  });

  it('ofrece un Quodom nuevo del rubro', () => {
    const p = montar();
    fireEvent.click(screen.getByRole('button', { name: /un quodom nuevo de pintura/i }));
    expect(p.onCrear).toHaveBeenCalledTimes(1);
  });

  it('sin candidatos ofrece sólo crear', () => {
    montar({ candidatos: [] });
    expect(screen.getByRole('button', { name: /un quodom nuevo de pintura/i })).toBeInTheDocument();
  });

  it('cancela con Escape y con el fondo, pero no con un click adentro', () => {
    const p = montar();
    fireEvent.click(screen.getByRole('dialog'));
    expect(p.onCancelar).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.click(screen.getByRole('dialog').parentElement as HTMLElement);
    expect(p.onCancelar).toHaveBeenCalledTimes(2);
  });

  it('ocupado deshabilita todo e ignora Escape', () => {
    const p = montar({ ocupado: true });
    screen.getAllByRole('button').forEach(b => expect(b).toBeDisabled());
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(p.onCancelar).not.toHaveBeenCalled();
  });

  it('muestra el mensaje de error dentro del diálogo', () => {
    montar({ error: 'No se pudo agregar el producto.' });
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo agregar el producto.');
  });
});

// En el catálogo este diálogo es lo que abre el clic en el producto: sin la
// ficha, ese clic dejó de mostrar qué es el producto antes de mandarlo.
describe('DialogoDestino · la ficha del producto', () => {
  const LATEX = {
    id: 137,
    nombre: 'Latex Interior Blanco Mate',
    descripcion: 'Para interiores, secado rápido.',
    atributos: [{ nombre: 'LITROS', valor: '20 litros' }, { nombre: 'MARCA', valor: null }]
  };

  it('muestra nombre, descripción y cada atributo con lo elegido', () => {
    montar({ producto: LATEX });

    expect(screen.getByText('Latex Interior Blanco Mate')).toBeInTheDocument();
    expect(screen.getByText(/secado rápido/i)).toBeInTheDocument();
    expect(screen.getByText('20 litros')).toBeInTheDocument();
    expect(screen.getByAltText('Latex Interior Blanco Mate')).toBeInTheDocument();
  });

  // Antes decía "Atributos: LITROS, MARCA": el nombre del grupo, que no
  // dice nada. Lo que importa es si ya está elegido.
  it('un atributo sin elegir lo dice', () => {
    montar({ producto: LATEX });

    expect(screen.getByText('sin elegir')).toBeInTheDocument();
  });

  // El buscador no tiene esos datos, y un "+" que encoló varias líneas no tiene
  // un producto que mostrar: el diálogo sigue sirviendo sin ficha.
  it('sin producto sigue preguntando el destino', () => {
    montar();

    expect(screen.getByRole('heading', { name: /sumar a.*pintura/i })).toBeInTheDocument();
    expect(screen.queryByText('sin elegir')).toBeNull();
  });
});

// La ventana nace de la tarjeta que se tocó y vuelve a ella al cancelar.
describe('DialogoDestino · el efecto desde la tarjeta', () => {
  const ORIGEN = { left: 40, top: 500, width: 160, height: 150, right: 200, bottom: 650, x: 40, y: 500, toJSON: () => ({}) } as DOMRect;
  type Animacion = { finished: Promise<void>; cancel: () => void };
  let animate: ReturnType<typeof vi.fn<unknown[], Animacion>>;

  beforeEach(() => {
    animate = vi.fn((..._args: unknown[]): Animacion => ({ finished: Promise.resolve(), cancel: () => {} }));
    (HTMLElement.prototype as unknown as { animate: unknown }).animate = animate;
  });
  afterEach(() => { delete (HTMLElement.prototype as unknown as { animate?: unknown }).animate; });

  it('con origen, crece desde la tarjeta', () => {
    montar({ origen: ORIGEN });
    expect(animate).toHaveBeenCalled();
    const [cuadros] = animate.mock.calls[0] as [Keyframe[]];
    expect(String(cuadros[0].transform)).toMatch(/translate/);
    expect(cuadros[cuadros.length - 1].transform).toBe('none');
  });

  it('al cancelar se achica hacia la tarjeta y recién después avisa', async () => {
    const p = montar({ origen: ORIGEN });
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(p.onCancelar).not.toHaveBeenCalled();
    await waitFor(() => expect(p.onCancelar).toHaveBeenCalledTimes(1));
    expect(animate).toHaveBeenCalledTimes(2);
  });

  it('sin origen no anima y cancela en el acto', () => {
    const p = montar();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(p.onCancelar).toHaveBeenCalledTimes(1);
    expect(animate).not.toHaveBeenCalled();
  });
});
