import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AgregarDireccion } from '../AgregarDireccion';
import { lugares } from '../../../api/lugares';
import { userDirecciones } from '../../../api/user_direcciones';
import { provincias } from '../../../api/provincias';
import { localidades } from '../../../api/localidades';

vi.mock('../../../api/lugares', () => ({ lugares: { sugerencias: vi.fn(), direccion: vi.fn() } }));
vi.mock('../../../api/user_direcciones', () => ({ userDirecciones: { create: vi.fn() } }));
vi.mock('../../../api/provincias', () => ({ provincias: { list: vi.fn() } }));
vi.mock('../../../api/localidades', () => ({ localidades: { porProvincia: vi.fn() } }));
vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual<typeof import('react-router-dom')>('react-router-dom')),
  useNavigate: () => vi.fn()
}));

const MITRE = {
  placeid: 'ChIJ-1', calle: 'Bartolomé Mitre', numero: '450', localidad: 'San Isidro',
  partido: 'San Isidro', idprovincia: 1, cp: 'B1642', lat: -34.4707, lng: -58.5075,
  direccion: 'Mitre 450, San Isidro, Provincia de Buenos Aires'
};

beforeEach(() => {
  // mockReset y no sólo mockResolvedValue: sin limpiar las llamadas,
  // `mock.calls[0]` es la del test anterior y las aserciones miran el cuerpo
  // equivocado — da un fallo que señala el campo que no corresponde.
  vi.mocked(userDirecciones.create).mockReset();
  vi.mocked(lugares.sugerencias).mockReset();
  vi.mocked(lugares.direccion).mockReset();
  vi.mocked(provincias.list).mockResolvedValue([{ id: 1, provincia: 'Buenos Aires' }] as never);
  vi.mocked(localidades.porProvincia).mockResolvedValue([] as never);
  vi.mocked(lugares.sugerencias).mockResolvedValue({
    sugerencias: [{ placeid: 'ChIJ-1', texto: 'Mitre 450, San Isidro' }]
  });
  vi.mocked(lugares.direccion).mockResolvedValue(MITRE);
  vi.mocked(userDirecciones.create).mockResolvedValue({ res: true, message: 'Creado.' } as never);
});

function montar() {
  return render(<MemoryRouter><AgregarDireccion /></MemoryRouter>);
}

async function elegirDelMapa() {
  fireEvent.change(screen.getByLabelText(/buscá tu dirección/i), { target: { value: 'mitre 450' } });
  fireEvent.click(await screen.findByRole('option', { name: /Mitre 450, San Isidro/ }));
  await waitFor(() => expect(screen.getByLabelText(/^Calle$/i)).toHaveValue('Bartolomé Mitre'));
}

describe('AgregarDireccion con el mapa', () => {
  // Esta es la unión que el mensaje de WhatsApp necesita: lee la dirección de
  // la vista `v_InfoCompradors` (calle, número, localidad, provincia, cp), no
  // de las coordenadas. Si esto dejara de llenar esas columnas, el proveedor
  // recibiría el pedido sin domicilio y ningún otro test lo notaría.
  it('lo elegido del mapa llena los campos que viajan en el WhatsApp', async () => {
    montar();
    await elegirDelMapa();

    expect(screen.getByLabelText(/^Calle$/i)).toHaveValue('Bartolomé Mitre');
    expect(screen.getByLabelText(/^Número$/i)).toHaveValue('450');
    expect(screen.getByLabelText(/^Localidad$/i)).toHaveValue('San Isidro');
    expect(screen.getByLabelText(/^CP$/i)).toHaveValue('B1642');
    expect(screen.getByLabelText(/^Provincia$/i)).toHaveValue('1');
  });

  it('guarda el placeid y las coordenadas junto con los campos de texto', async () => {
    montar();
    await elegirDelMapa();

    fireEvent.submit(screen.getByRole('button', { name: /guardar/i }).closest('form')!);

    await waitFor(() => expect(userDirecciones.create).toHaveBeenCalled());
    expect(vi.mocked(userDirecciones.create).mock.calls[0][0]).toMatchObject({
      calle: 'Bartolomé Mitre', numero: '450', localidad: 'San Isidro',
      cp: 'B1642', idprovincia: 1,
      placeid: 'ChIJ-1', lat: -34.4707, lng: -58.5075
    });
  });

  // El riesgo central de la spec: si el usuario corrige la calle a mano, las
  // coordenadas del mapa ya no describen esa dirección. Quedarse con ellas
  // produce una fila cuyo texto dice una cosa y cuyo punto está en otra, y eso
  // más adelante no se ve como un error: se ve como una lista de proveedores
  // perfectamente ordenada alrededor del lugar equivocado.
  it('editar la calle a mano borra las coordenadas del mapa', async () => {
    montar();
    await elegirDelMapa();

    fireEvent.change(screen.getByLabelText(/^Calle$/i), { target: { value: 'Rivadavia' } });
    fireEvent.submit(screen.getByRole('button', { name: /guardar/i }).closest('form')!);

    await waitFor(() => expect(userDirecciones.create).toHaveBeenCalled());
    const body = vi.mocked(userDirecciones.create).mock.calls[0][0];
    expect(body.calle).toBe('Rivadavia');
    expect(body.placeid).toBeNull();
    expect(body.lat).toBeNull();
    expect(body.lng).toBeNull();
  });

  // Cambiar el alias o el piso no mueve la dirección, así que las coordenadas
  // siguen siendo válidas. Borrarlas ahí sería perder el dato por nada.
  it('editar el alias o el piso no borra las coordenadas', async () => {
    montar();
    await elegirDelMapa();

    fireEvent.change(screen.getByLabelText(/alias/i), { target: { value: 'Obra' } });
    fireEvent.change(screen.getByLabelText(/piso/i), { target: { value: '3B' } });
    fireEvent.submit(screen.getByRole('button', { name: /guardar/i }).closest('form')!);

    await waitFor(() => expect(userDirecciones.create).toHaveBeenCalled());
    expect(vi.mocked(userDirecciones.create).mock.calls[0][0]).toMatchObject({
      alias: 'Obra', piso: '3B', placeid: 'ChIJ-1', lat: -34.4707
    });
  });
});
