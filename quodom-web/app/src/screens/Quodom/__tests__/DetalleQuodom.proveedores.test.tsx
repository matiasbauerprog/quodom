import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DetalleQuodom } from '../DetalleQuodom';
import { useAuth } from '../../../auth/AuthContext';
import { quodom } from '../../../api/quodom';
import { quodomLines } from '../../../api/quodom_lines';
import { proveedores } from '../../../api/proveedores';
import { users } from '../../../api/users';

vi.mock('../../../auth/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../../../api/quodom', () => ({
  quodom: {
    misQuodom: vi.fn(), porId: vi.fn(), update: vi.fn(), whatsapp: vi.fn(),
    activosPorRubro: vi.fn(), create: vi.fn(), eliminar: vi.fn()
  }
}));
vi.mock('../../../api/quodom_lines', () => ({
  quodomLines: { porQuodom: vi.fn(), update: vi.fn(), eliminar: vi.fn(), add: vi.fn(), atributos: vi.fn() }
}));
vi.mock('../../../api/proveedores', () => ({ proveedores: { delQuodom: vi.fn(), noEnviado: vi.fn() } }));
vi.mock('../../../api/categorias', () => ({ categorias: { raiz: vi.fn() } }));
vi.mock('../../../api/users', () => ({ users: { getDirecciones: vi.fn() } }));
const abrirWhatsapp = vi.hoisted(() => vi.fn());
vi.mock('../../../utils/whatsapp', () => ({ openWhatsappLink: abrirWhatsapp }));

const USUARIO = { id: 'u1', username: 'ana', email: 'ana@test.com', nombre: 'Ana' };

const LE_BLEU = {
  placeid: 'p1', nombre: 'Pinturerías Le Bleu', rating: 4.9, resenas: 190,
  distanciakm: 0.4, telefono: '+541166687854', telefonovisible: '011 6668-7854',
  sintelefono: false, sinwhatsapp: false, sindatos: false, direccion: 'Almte Brown 3185',
  contactadoen: null
};
const OTRO = {
  placeid: 'p2', nombre: 'Pinturería Del Barrio', rating: 4.1, resenas: 22,
  distanciakm: 1.1, telefono: '+541155550000', telefonovisible: '011 5555-0000',
  sintelefono: false, sinwhatsapp: false, sindatos: false, direccion: 'Mitre 100',
  contactadoen: null
};

// La fecha va relativa a ahora: una fija envejece y el renglón del contactado
// empieza a decir otra cosa sin que nadie toque el código.
function haceUnaHora(): string {
  return new Date(Date.now() - 60 * 60 * 1000).toISOString();
}

const LINEA = {
  id: 11, idquodom: 'q-7', idproducto: 302, cantidad: 2,
  nombreProducto: 'Latex Interior Blanco Mate'
};

function montar({ estado }: { estado: 'CREADO' | 'ENVIADO' }) {
  vi.mocked(quodom.porId).mockResolvedValue({
    id: 'q-7', nro: 'QD-7', descripcion: 'Pintura del frente', estado, idrubro: 1
  } as never);
  return render(
    <MemoryRouter initialEntries={['/quodom?id=q-7']}><DetalleQuodom /></MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useAuth).mockReturnValue({ user: USUARIO } as unknown as ReturnType<typeof useAuth>);
  vi.mocked(quodomLines.porQuodom).mockResolvedValue([LINEA] as never);
  // La pantalla pregunta si el usuario tiene dirección para saber si puede
  // enviar; sin respuesta el efecto rompe el render.
  vi.mocked(users.getDirecciones).mockResolvedValue([{ id: 1 } as never]);
  vi.mocked(proveedores.delQuodom).mockResolvedValue({
    proveedores: [{ ...LE_BLEU, contactadoen: haceUnaHora() }, OTRO],
    preciso: true, desde: 'Brown 3185', atribucion: 'Resultados de Google'
  });
});

// Un Quodom enviado no termina en "enviado": el comprador le manda a uno, no le
// contestan, y le manda a otro. Para eso tiene que ver a quién ya le mandó, y
// eso sólo lo sabe el servidor.
describe('DetalleQuodom: los proveedores de un Quodom enviado', () => {
  it('un Quodom enviado muestra a cuántos proveedores les mandó', async () => {
    montar({ estado: 'ENVIADO' });

    expect(await screen.findByText(/1 de 2/i)).toBeInTheDocument();
    expect(screen.getByText('Pinturerías Le Bleu')).toBeInTheDocument();
    expect(screen.getByText('Pinturería Del Barrio')).toBeInTheDocument();
  });

  it('deja mandarle a los que faltan', async () => {
    vi.mocked(quodom.whatsapp).mockResolvedValue({ res: true, link: 'https://wa.me/541155550000?text=hola' });

    montar({ estado: 'ENVIADO' });

    fireEvent.click(await screen.findByRole('button', { name: /enviar por whatsapp/i }));

    await waitFor(() => expect(quodom.whatsapp).toHaveBeenCalledWith('q-7', { proveedor: 'p2', tel: '+541155550000' }));
    await waitFor(() => expect(abrirWhatsapp).toHaveBeenCalledWith('https://wa.me/541155550000?text=hola'));
  });

  // El renglón del contactado es el mismo del selector, con sus tres estados de
  // teléfono: si se copiara, las dos copias se despegarían.
  //
  // Lo que no viaja es "No se envió". Ese botón escribe `sin_whatsapp`, un dato
  // global, permanente y sin fecha por place_id que leen las listas de todos
  // los demás compradores, y lo que lo justifica es "acabé de tocar el botón y
  // WhatsApp no abrió". Desde el historial, tres semanas después, es un
  // recuerdo y no una observación: el comercio puede haber activado WhatsApp, y
  // lo que el comprador suele estar explicando es que no le contestaron, que es
  // otra cosa. De paso, deshacer el único contactado dejaba la sección diciendo
  // "Le mandaste a 0 de 2" debajo de un botón que dice "Ya cotizado".
  it('al contactado le deja volver a enviar, pero no deshacer el envío', async () => {
    montar({ estado: 'ENVIADO' });

    expect(await screen.findByText(/ya le mandaste/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /volver a enviar/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /no se envió/i })).toBeNull();
    // El de los que faltan sigue estando: la sección existe para eso.
    expect(screen.getByRole('button', { name: /enviar por whatsapp/i })).toBeInTheDocument();
  });

  // Cada apertura es una búsqueda **paga** a Google, con tope de 10/min por
  // usuario. Enviar desde el detalle costaba TRES: la que abre el selector, la
  // recarga que ya no existe (el valor nuevo se conoce) y la de la sección,
  // montada detrás del selector abierto o al cerrarlo, para una lista que el
  // comprador acababa de ver en el diálogo. Medido: 3 por envío, 1 necesaria.
  it('enviar desde el detalle gasta una sola búsqueda', async () => {
    vi.mocked(quodom.porId).mockResolvedValueOnce({
      id: 'q-7', nro: 'QD-7', descripcion: 'Pintura del frente', estado: 'CREADO', idrubro: 1
    } as never);
    vi.mocked(quodom.whatsapp).mockResolvedValue({ res: true, link: 'https://wa.me/541155550000?text=hola' });

    montar({ estado: 'ENVIADO' });
    await screen.findByText('Latex Interior Blanco Mate');

    fireEvent.click(screen.getByRole('button', { name: 'Cotizar por WhatsApp' }));
    // 1: la que abre el selector.
    await waitFor(() => expect(proveedores.delQuodom).toHaveBeenCalledTimes(1));

    fireEvent.click(await screen.findByRole('button', { name: /enviar por whatsapp/i }));
    await waitFor(() => expect(quodom.whatsapp).toHaveBeenCalled());

    // El renglón queda marcado sin preguntarle de nuevo a Google: los dos
    // proveedores de la lista quedan con su marca (uno venía de antes).
    expect(await screen.findAllByText(/ya le mandaste/i)).toHaveLength(2);
    expect(proveedores.delQuodom).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/cerca de/i)).not.toBeNull();

    // Y cerrar el selector tampoco gasta otra: el comprador acaba de ver esa
    // misma lista en el diálogo. La sección aparece la próxima vez que entra.
    fireEvent.click(screen.getByRole('button', { name: /cerrar/i }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(proveedores.delQuodom).toHaveBeenCalledTimes(1);
  });

  it('un Quodom en armado no muestra la sección', async () => {
    montar({ estado: 'CREADO' });

    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByText(/proveedores contactados/i)).toBeNull();
    // Y no gasta una búsqueda paga a Google en una pantalla que no la pidió.
    expect(proveedores.delQuodom).not.toHaveBeenCalled();
  });

  // Los términos de Google exigen la atribución donde se muestran sus datos, y
  // esto es una segunda pantalla que los muestra.
  it('muestra la atribución de Google', async () => {
    montar({ estado: 'ENVIADO' });

    expect(await screen.findByText('Resultados de Google')).toBeInTheDocument();
  });

  // Google puede fallar o cortar por el tope de 10/min. Acá no hay nada que
  // enviar de urgencia, así que alcanza con decirlo —en castellano y sin el
  // texto de diagnóstico del servidor— y no romper la pantalla.
  it('si la búsqueda falla lo dice y el Quodom sigue a la vista', async () => {
    vi.mocked(proveedores.delQuodom).mockRejectedValue(new Error('places: HTTP 503'));

    montar({ estado: 'ENVIADO' });

    expect(await screen.findByText(/no pudimos consultar el mapa/i)).toBeInTheDocument();
    expect(screen.queryByText(/places: HTTP/i)).toBeNull();
    expect(screen.getByText('Latex Interior Blanco Mate')).toBeInTheDocument();
  });
});
