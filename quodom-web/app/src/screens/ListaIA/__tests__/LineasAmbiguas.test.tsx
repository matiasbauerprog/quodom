import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { LineasAmbiguas } from '../LineasAmbiguas';
import type { ListaAmbigua } from '../../../api/lista';

const LINEA: ListaAmbigua = {
  textoOriginal: '3 platos descartables',
  cantidad: 3,
  sugerido: 493,
  candidatos: [
    { idproducto: 455, nombreProducto: 'Plato por 10 unidades', idrubro: 3, rubro: 'Papelera' },
    { idproducto: 493, nombreProducto: 'Plato descartable por 100 unidades', idrubro: 3, rubro: 'Papelera' }
  ]
};

describe('LineasAmbiguas', () => {
  it('no dibuja nada sin líneas', () => {
    const { container } = render(<LineasAmbiguas lineas={[]} onElegir={vi.fn()} onDescartar={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('muestra el renglón original y los candidatos con su rubro', () => {
    render(<LineasAmbiguas lineas={[LINEA]} onElegir={vi.fn()} onDescartar={vi.fn()} />);

    const bloque = screen.getByRole('region', { name: /tenés que elegir/i });
    expect(within(bloque).getByText(/3 platos descartables/)).toBeInTheDocument();
    expect(within(bloque).getByRole('button', { name: /plato por 10 unidades/i })).toBeInTheDocument();
    expect(within(bloque).getByRole('button', { name: /plato descartable por 100 unidades/i })).toBeInTheDocument();
    expect(within(bloque).getAllByText(/papelera/i).length).toBeGreaterThan(0);
  });

  it('marca el sugerido y no el resto', () => {
    render(<LineasAmbiguas lineas={[LINEA]} onElegir={vi.fn()} onDescartar={vi.fn()} />);

    expect(screen.getByRole('button', { name: /plato descartable por 100 unidades/i }))
      .toHaveTextContent(/sugerido/i);
    expect(screen.getByRole('button', { name: /plato por 10 unidades/i }))
      .not.toHaveTextContent(/sugerido/i);
  });

  it('avisa qué candidato se eligió', () => {
    const onElegir = vi.fn();
    render(<LineasAmbiguas lineas={[LINEA]} onElegir={onElegir} onDescartar={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /plato por 10 unidades/i }));

    expect(onElegir).toHaveBeenCalledWith(LINEA, LINEA.candidatos[0]);
  });

  it('avisa cuando se descarta la línea', () => {
    const onDescartar = vi.fn();
    render(<LineasAmbiguas lineas={[LINEA]} onElegir={vi.fn()} onDescartar={onDescartar} />);

    fireEvent.click(screen.getByRole('button', { name: /descartar/i }));

    expect(onDescartar).toHaveBeenCalledWith(LINEA);
  });

  it('dice cuántas líneas hay esperando', () => {
    const otra: ListaAmbigua = { ...LINEA, textoOriginal: '2 papeles' };
    render(<LineasAmbiguas lineas={[LINEA, otra]} onElegir={vi.fn()} onDescartar={vi.fn()} />);

    expect(screen.getByRole('region', { name: /tenés que elegir/i })).toHaveTextContent(/2/);
  });
});
