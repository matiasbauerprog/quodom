import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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
    atributos: ['LITROS: 20 litros', null]
  };

  it('muestra nombre, descripción y el atributo con lo elegido', () => {
    montar({ producto: LATEX });

    expect(screen.getByText('Latex Interior Blanco Mate')).toBeInTheDocument();
    expect(screen.getByText(/secado rápido/i)).toBeInTheDocument();
    expect(screen.getByText(/LITROS: 20 litros/)).toBeInTheDocument();
    expect(screen.getByAltText('Latex Interior Blanco Mate')).toBeInTheDocument();
  });

  it('un atributo sin valor elegido muestra sólo el grupo', () => {
    montar({ producto: { ...LATEX, atributos: ['LITROS', null] } });

    expect(screen.getByText('Atributos: LITROS')).toBeInTheDocument();
  });

  // El buscador no tiene esos datos, y un "+" que encoló varias líneas no tiene
  // un producto que mostrar: el diálogo sigue sirviendo sin cabecera.
  it('sin producto sigue preguntando el destino', () => {
    montar();

    expect(screen.getByRole('heading', { name: /a qué quodom de pintura/i })).toBeInTheDocument();
    expect(screen.queryByText(/atributos:/i)).toBeNull();
  });
});
