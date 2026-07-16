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
});
