import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PropuestaEditable } from '../PropuestaEditable';
import type { IaProposalItem } from '../../../api/ia';

const items: IaProposalItem[] = [
  { idproducto: 1, cantidad: 2, motivo: 'a', nombreProducto: 'Prod A' },
  { idproducto: 2, cantidad: 1, motivo: 'b', nombreProducto: 'Prod B' }
];

describe('PropuestaEditable', () => {
  it('renders all items and their quantities', () => {
    render(<PropuestaEditable items={items} onConfirm={() => {}} />);
    expect(screen.getByText('Prod A')).toBeInTheDocument();
    expect(screen.getByText('Prod B')).toBeInTheDocument();
    expect(screen.getByLabelText(/cantidad de prod a/i)).toHaveValue(2);
  });

  it('increments and decrements quantity (min 1)', () => {
    render(<PropuestaEditable items={items} onConfirm={() => {}} />);
    const dec = screen.getByLabelText(/quitar uno de prod a/i);
    const inc = screen.getByLabelText(/sumar uno a prod a/i);
    fireEvent.click(inc); fireEvent.click(inc);
    expect(screen.getByLabelText(/cantidad de prod a/i)).toHaveValue(4);
    fireEvent.click(dec); fireEvent.click(dec); fireEvent.click(dec); fireEvent.click(dec);
    expect(screen.getByLabelText(/cantidad de prod a/i)).toHaveValue(1);
  });

  it('removes an item with the × button', () => {
    render(<PropuestaEditable items={items} onConfirm={() => {}} />);
    fireEvent.click(screen.getByLabelText(/quitar prod b/i));
    expect(screen.queryByText('Prod B')).not.toBeInTheDocument();
  });

  it('disables the confirm button when there are no items', () => {
    render(<PropuestaEditable items={[items[0]]} onConfirm={() => {}} />);
    fireEvent.click(screen.getByLabelText(/quitar prod a/i));
    expect(screen.getByRole('button', { name: /agregar al quodom/i })).toBeDisabled();
  });

  it('calls onConfirm with the current item list', () => {
    const spy = vi.fn();
    render(<PropuestaEditable items={items} onConfirm={spy} />);
    fireEvent.click(screen.getByLabelText(/sumar uno a prod a/i));
    fireEvent.click(screen.getByRole('button', { name: /agregar al quodom/i }));
    expect(spy).toHaveBeenCalledWith([
      { idproducto: 1, cantidad: 3, motivo: 'a', nombreProducto: 'Prod A' },
      { idproducto: 2, cantidad: 1, motivo: 'b', nombreProducto: 'Prod B' }
    ]);
  });

  it('renders no attribute selector for a product without attributes', () => {
    render(<PropuestaEditable items={items} onConfirm={() => {}} />);
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });
});

const conAtributos: IaProposalItem[] = [
  {
    idproducto: 302, cantidad: 3, motivo: '60m² a 2 manos', nombreProducto: 'Latex Mate',
    nombreAtributo1: 'LITROS', atributo1: '20 litros',
    opcionesAtributo1: ['1 litro', '4 litros', '10 litros', '20 litros'],
    nombreAtributo2: 'MARCA', atributo2: null,
    opcionesAtributo2: ['Alba', 'Colorin']
  }
];

describe('PropuestaEditable (atributos)', () => {
  it('preselects the value the assistant chose', () => {
    render(<PropuestaEditable items={conAtributos} onConfirm={() => {}} />);
    expect(screen.getByLabelText(/litros de latex mate/i)).toHaveValue('20 litros');
  });

  it('leaves the selector on "Elegir" when the assistant chose nothing', () => {
    render(<PropuestaEditable items={conAtributos} onConfirm={() => {}} />);
    expect(screen.getByLabelText(/marca de latex mate/i)).toHaveValue('');
  });

  it('offers every value the catalogue has for that product', () => {
    render(<PropuestaEditable items={conAtributos} onConfirm={() => {}} />);
    const select = screen.getByLabelText(/litros de latex mate/i);
    expect(Array.from(select.querySelectorAll('option')).map(o => o.textContent))
      .toEqual(['Elegir', '1 litro', '4 litros', '10 litros', '20 litros']);
  });

  it('confirms the value the user picked, not the one the assistant proposed', () => {
    const spy = vi.fn();
    render(<PropuestaEditable items={conAtributos} onConfirm={spy} />);
    fireEvent.change(screen.getByLabelText(/litros de latex mate/i), { target: { value: '4 litros' } });
    fireEvent.change(screen.getByLabelText(/marca de latex mate/i), { target: { value: 'Alba' } });
    fireEvent.click(screen.getByRole('button', { name: /agregar al quodom/i }));
    expect(spy).toHaveBeenCalledWith([
      expect.objectContaining({ idproducto: 302, atributo1: '4 litros', atributo2: 'Alba' })
    ]);
  });

  it('clears the attribute again when the user goes back to "Elegir"', () => {
    const spy = vi.fn();
    render(<PropuestaEditable items={conAtributos} onConfirm={spy} />);
    fireEvent.change(screen.getByLabelText(/litros de latex mate/i), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: /agregar al quodom/i }));
    expect(spy).toHaveBeenCalledWith([expect.objectContaining({ atributo1: null })]);
  });
});
