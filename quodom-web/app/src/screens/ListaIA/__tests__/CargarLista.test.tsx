import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CargarLista } from '../CargarLista';

function archivoFalso(nombre: string, bytes: number, tipo = 'image/jpeg') {
  const file = new File(['x'], nombre, { type: tipo });
  Object.defineProperty(file, 'size', { value: bytes });
  return file;
}

describe('CargarLista', () => {
  it('manda el texto pegado como entrada de tipo texto', () => {
    const onEnviar = vi.fn();
    render(<CargarLista onEnviar={onEnviar} />);

    fireEvent.change(screen.getByLabelText(/pegá tu lista/i), {
      target: { value: '3 lavandinas 5L' }
    });
    fireEvent.click(screen.getByRole('button', { name: /buscar en el catálogo/i }));

    expect(onEnviar).toHaveBeenCalledWith({ tipo: 'texto', texto: '3 lavandinas 5L' });
  });

  it('no manda nada con el texto vacío', () => {
    const onEnviar = vi.fn();
    render(<CargarLista onEnviar={onEnviar} />);

    fireEvent.click(screen.getByRole('button', { name: /buscar en el catálogo/i }));

    expect(onEnviar).not.toHaveBeenCalled();
  });

  it('rechaza una extensión no permitida sin llamar al API', async () => {
    const onEnviar = vi.fn();
    render(<CargarLista onEnviar={onEnviar} />);

    fireEvent.change(screen.getByLabelText(/subí un archivo/i), {
      target: { files: [archivoFalso('lista.docx', 1000)] }
    });

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/no se puede leer/i));
    expect(onEnviar).not.toHaveBeenCalled();
  });

  it('rechaza un archivo de más de 5 MB sin llamar al API', async () => {
    const onEnviar = vi.fn();
    render(<CargarLista onEnviar={onEnviar} />);

    fireEvent.change(screen.getByLabelText(/subí un archivo/i), {
      target: { files: [archivoFalso('foto.jpg', 6 * 1024 * 1024)] }
    });

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/5 MB/i));
    expect(onEnviar).not.toHaveBeenCalled();
  });

  it('manda un archivo válido como entrada de tipo archivo', async () => {
    const onEnviar = vi.fn();
    render(<CargarLista onEnviar={onEnviar} />);

    fireEvent.change(screen.getByLabelText(/subí un archivo/i), {
      target: { files: [archivoFalso('foto.jpg', 1000)] }
    });

    await waitFor(() => expect(onEnviar).toHaveBeenCalled());
    const entrada = onEnviar.mock.calls[0][0];
    expect(entrada.tipo).toBe('archivo');
    expect(entrada.archivo.nombre).toBe('foto.jpg');
    expect(typeof entrada.archivo.datosBase64).toBe('string');
  });
});
