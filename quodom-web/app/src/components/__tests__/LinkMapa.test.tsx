import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LinkMapa } from '../LinkMapa';

describe('LinkMapa', () => {
  it('lleva al punto exacto en Google Maps', () => {
    render(<LinkMapa lat={-34.6037} lng={-58.3816} />);

    const link = screen.getByRole('link', { name: /ver en el mapa/i });
    expect(link).toHaveAttribute('href', 'https://www.google.com/maps?q=-34.6037,-58.3816');
  });

  // Se abre aparte: el usuario está en medio de un formulario y perder lo
  // cargado por ir a mirar el mapa sería peor que no ofrecerlo.
  it('abre en otra pestaña, sin dejarle el handle a la página de destino', () => {
    render(<LinkMapa lat={-34.6} lng={-58.4} />);

    const link = screen.getByRole('link', { name: /ver en el mapa/i });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  // Una dirección cargada a mano no tiene punto, y ahí la ausencia del link es
  // información: avisa que esa dirección no va a servir para buscar proveedores.
  it('no muestra nada cuando la dirección no tiene coordenadas', () => {
    const { container } = render(<LinkMapa lat={null} lng={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('tampoco muestra nada con una sola de las dos', () => {
    const { container } = render(<LinkMapa lat={-34.6} lng={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
