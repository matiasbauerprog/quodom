import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DialogoProveedores } from '../DialogoProveedores';
import { proveedores } from '../../api/proveedores';
import { quodom } from '../../api/quodom';

vi.mock('../../api/proveedores', () => ({ proveedores: { delQuodom: vi.fn(), noEnviado: vi.fn() } }));
vi.mock('../../api/quodom', () => ({ quodom: { whatsapp: vi.fn() } }));
const abrir = vi.hoisted(() => vi.fn());
vi.mock('../../utils/whatsapp', () => ({ openWhatsappLink: abrir }));

const LE_BLEU = {
  placeid: 'p1', nombre: 'Pinturerías Le Bleu', rating: 4.9, resenas: 190,
  distanciakm: 0.4, telefono: '+541166687854', telefonovisible: '011 6668-7854',
  sintelefono: false, esfijo: true, sinwhatsapp: false, direccion: 'Almte Brown 3185',
  contactadoen: null
};
const SIN_TEL = {
  placeid: 'p2', nombre: 'JB Artículos de Limpieza', rating: 4.3, resenas: 3,
  distanciakm: 0.4, telefono: null, telefonovisible: null,
  sintelefono: true, esfijo: false, sinwhatsapp: false, direccion: 'Pacífico Rodríguez 5369',
  contactadoen: null
};
// Medido contra la API de Google: un 0800 es un número real y válido que no
// recibe WhatsApp, así que llega SIN número de WhatsApp y CON número visible.
// Sin este caso en los tests, condicionar el botón a `!sintelefono` en vez de a
// `telefono` pasa igual, y el comprador termina en un chat que no abre nunca.
const REX_0800 = {
  placeid: 'p3', nombre: 'Rex', rating: 4.5, resenas: 453,
  distanciakm: 1.2, telefono: null, telefonovisible: '0800-777-7739',
  sintelefono: false, esfijo: false, sinwhatsapp: false, direccion: 'Córdoba 1234',
  contactadoen: null
};

function respuesta(extra = {}) {
  return { proveedores: [LE_BLEU], preciso: true, desde: 'Almte Brown 3185', atribucion: 'Resultados de Google', ...extra };
}

// El aviso del punto aproximado linkea a /direcciones con el router, así que el
// diálogo se monta siempre dentro de uno.
function montar(props: { idquodom?: string; onCerrar?: () => void; onEnviadoSinProveedor?: () => void } = {}) {
  return render(
    <MemoryRouter>
      <DialogoProveedores idquodom={props.idquodom ?? 'q1'} onCerrar={props.onCerrar ?? vi.fn()} onEnviadoSinProveedor={props.onEnviadoSinProveedor} />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.mocked(proveedores.delQuodom).mockReset();
  vi.mocked(proveedores.noEnviado).mockReset();
  vi.mocked(quodom.whatsapp).mockReset();
  abrir.mockReset();
});

describe('DialogoProveedores', () => {
  it('muestra cada proveedor con su puntuación y su distancia', async () => {
    vi.mocked(proveedores.delQuodom).mockResolvedValue(respuesta());

    montar();

    expect(await screen.findByText('Pinturerías Le Bleu')).toBeInTheDocument();
    expect(screen.getByText(/4,9|4\.9/)).toBeInTheDocument();
    expect(screen.getByText(/0,4 km|0\.4 km/)).toBeInTheDocument();
  });

  // Los términos de Google exigen la atribución. Sin esta aserción, borrar el
  // renglón deja la suite verde y nos pone fuera de los términos.
  it('muestra la atribución de Google', async () => {
    vi.mocked(proveedores.delQuodom).mockResolvedValue(respuesta());

    montar();

    expect(await screen.findByText('Resultados de Google')).toBeInTheDocument();
  });

  it('al elegir uno abre WhatsApp con ese número', async () => {
    vi.mocked(proveedores.delQuodom).mockResolvedValue(respuesta());
    vi.mocked(quodom.whatsapp).mockResolvedValue({ res: true, link: 'https://wa.me/541166687854?text=hola' });

    montar();
    fireEvent.click(await screen.findByRole('button', { name: /whatsapp/i }));

    await waitFor(() => expect(abrir).toHaveBeenCalledWith('https://wa.me/541166687854?text=hola'));
    expect(quodom.whatsapp).toHaveBeenCalledWith('q1', { proveedor: 'p1', tel: '+541166687854' });
  });

  it('al volver, el contactado queda marcado y los demás siguen disponibles', async () => {
    vi.mocked(proveedores.delQuodom).mockResolvedValue(respuesta({
      proveedores: [{ ...LE_BLEU, contactadoen: new Date().toISOString() }, SIN_TEL]
    }));

    montar();

    expect(await screen.findByText(/ya le mandaste/i)).toBeInTheDocument();
    expect(screen.getByText('JB Artículos de Limpieza')).toBeInTheDocument();
  });

  // El caso más común de todos: le mandó, no le contestaron, le manda otra vez.
  // El backend no lo impide y refresca la marca.
  it('al contactado se le puede volver a enviar', async () => {
    vi.mocked(proveedores.delQuodom).mockResolvedValue(respuesta({
      proveedores: [{ ...LE_BLEU, contactadoen: new Date().toISOString() }]
    }));
    vi.mocked(quodom.whatsapp).mockResolvedValue({ res: true, link: 'https://wa.me/541166687854?text=hola' });

    montar();
    fireEvent.click(await screen.findByRole('button', { name: /volver a enviar/i }));

    await waitFor(() => expect(quodom.whatsapp).toHaveBeenCalledWith('q1', { proveedor: 'p1', tel: '+541166687854' }));
    expect(abrir).toHaveBeenCalledWith('https://wa.me/541166687854?text=hola');
  });

  // Review Focus 2: medido, existen.
  it('un proveedor sin teléfono no ofrece WhatsApp ni llamar, y lo dice', async () => {
    vi.mocked(proveedores.delQuodom).mockResolvedValue(respuesta({ proveedores: [SIN_TEL] }));

    montar();

    expect(await screen.findByText(/no tiene el teléfono/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /whatsapp/i })).toBeNull();
    expect(screen.queryByRole('link', { name: /llamar/i })).toBeNull();
    expect(screen.getByRole('link', { name: /maps/i })).toBeInTheDocument();
  });

  it('un 0800 ofrece llamar pero no WhatsApp, y dice por qué', async () => {
    vi.mocked(proveedores.delQuodom).mockResolvedValue(respuesta({ proveedores: [REX_0800] }));

    montar();

    expect(await screen.findByText('Rex')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /whatsapp/i })).toBeNull();
    expect(screen.getByText(/no recibe whatsapp/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /llamar/i })).toHaveAttribute('href', 'tel:08007777739');
    expect(screen.getByRole('link', { name: /maps/i })).toBeInTheDocument();
  });

  it('avisa que un fijo puede no tener WhatsApp, sin bloquearlo', async () => {
    vi.mocked(proveedores.delQuodom).mockResolvedValue(respuesta());

    montar();

    expect(await screen.findByText(/puede no tener whatsapp/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /whatsapp/i })).toBeEnabled();
  });

  it('cuando el punto es aproximado lo dice y linkea a direcciones', async () => {
    vi.mocked(proveedores.delQuodom).mockResolvedValue(respuesta({ preciso: false, desde: 'Villa Ballester' }));

    montar();

    expect(await screen.findByText(/centro de la localidad/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /dirección/i })).toHaveAttribute('href', '/direcciones');
  });

  // Review Focus 1 y 5: sin proveedores, o con Google caído, el usuario TIENE
  // que poder mandar igual. Es el camino que existe hoy.
  it('sin proveedores ofrece enviar sin destinatario', async () => {
    vi.mocked(proveedores.delQuodom).mockResolvedValue(respuesta({ proveedores: [] }));

    montar();

    expect(await screen.findByRole('button', { name: /enviar sin elegir/i })).toBeInTheDocument();
  });

  it('si la búsqueda falla igual ofrece enviar sin destinatario', async () => {
    vi.mocked(proveedores.delQuodom).mockRejectedValue(new Error('503'));

    montar();

    expect(await screen.findByRole('button', { name: /enviar sin elegir/i })).toBeInTheDocument();
  });

  // Que el botón exista no alcanza: mandar el par a medias (`proveedor` sin
  // `tel`, o los dos vacíos) es un 400 del servidor, y el comprador se queda
  // sin enviar justo en el camino que existe para que siempre pueda.
  it('enviar sin elegir proveedor manda el Quodom sin parámetros', async () => {
    vi.mocked(proveedores.delQuodom).mockRejectedValue(new Error('503'));
    vi.mocked(quodom.whatsapp).mockResolvedValue({ res: true, link: 'https://wa.me/?text=hola' });
    const onEnviadoSinProveedor = vi.fn();

    montar({ onEnviadoSinProveedor });
    fireEvent.click(await screen.findByRole('button', { name: /enviar sin elegir/i }));

    await waitFor(() => expect(abrir).toHaveBeenCalledWith('https://wa.me/?text=hola'));
    expect(quodom.whatsapp).toHaveBeenCalledWith('q1');
    expect(vi.mocked(quodom.whatsapp).mock.calls[0]).toEqual(['q1']);
    expect(onEnviadoSinProveedor).toHaveBeenCalled();
  });

  it('deshacer un envío pregunta por qué y reporta que no tiene WhatsApp', async () => {
    vi.mocked(proveedores.delQuodom).mockResolvedValue(respuesta({
      proveedores: [{ ...LE_BLEU, contactadoen: new Date().toISOString() }]
    }));
    vi.mocked(proveedores.noEnviado).mockResolvedValue({ res: true });

    montar();
    fireEvent.click(await screen.findByRole('button', { name: /no se envió/i }));
    fireEvent.click(await screen.findByRole('button', { name: /no tiene whatsapp/i }));

    await waitFor(() => expect(proveedores.noEnviado).toHaveBeenCalledWith('q1', 'p1', 'sin_whatsapp'));
    // El renglón vuelve a la lista con el 200 del propio noEnviado: volver a
    // preguntarle a Google es una búsqueda paga, y con el tope de 10/min puede
    // fallar y dejar al comprador sin la lista que ya tenía.
    await waitFor(() => expect(screen.queryByText(/ya le mandaste/i)).toBeNull());
    expect(proveedores.delQuodom).toHaveBeenCalledTimes(1);
  });

  // Los dos vectores de escritura accidental sobre `sin_whatsapp`, que es
  // global, permanente y sin forma de deshacerse: abrir el grupo de motivos y
  // no tener forma de salir, y que el grupo quede abierto después de un
  // reintento que funcionó.
  it('el grupo de motivos se puede cerrar sin reportar nada', async () => {
    vi.mocked(proveedores.delQuodom).mockResolvedValue(respuesta({
      proveedores: [{ ...LE_BLEU, contactadoen: new Date().toISOString() }]
    }));

    montar();
    fireEvent.click(await screen.findByRole('button', { name: /no se envió/i }));
    fireEvent.click(await screen.findByRole('button', { name: /^cancelar$/i }));

    await waitFor(() => expect(screen.queryByRole('button', { name: /no tiene whatsapp/i })).toBeNull());
    expect(proveedores.noEnviado).not.toHaveBeenCalled();
    // Y el camino sigue disponible: cancelar no es "no preguntes más".
    expect(screen.getByRole('button', { name: /no se envió/i })).toBeInTheDocument();
  });

  it('un reintento que funciona cierra el grupo de motivos', async () => {
    vi.mocked(proveedores.delQuodom).mockResolvedValue(respuesta({
      proveedores: [{ ...LE_BLEU, contactadoen: new Date().toISOString() }]
    }));
    vi.mocked(quodom.whatsapp).mockResolvedValue({ res: true, link: 'https://wa.me/541166687854?text=hola' });

    montar();
    fireEvent.click(await screen.findByRole('button', { name: /no se envió/i }));
    fireEvent.click(screen.getByRole('button', { name: /volver a enviar/i }));

    await waitFor(() => expect(abrir).toHaveBeenCalled());
    // Con el grupo abierto, el toque siguiente cae sobre "No tiene WhatsApp" y
    // reporta al comercio para todos los compradores del país.
    expect(screen.queryByRole('button', { name: /no tiene whatsapp/i })).toBeNull();
    expect(proveedores.noEnviado).not.toHaveBeenCalled();
  });

  it('deshacer por otro motivo no lo reporta como sin WhatsApp', async () => {
    vi.mocked(proveedores.delQuodom).mockResolvedValue(respuesta({
      proveedores: [{ ...LE_BLEU, contactadoen: new Date().toISOString() }]
    }));
    vi.mocked(proveedores.noEnviado).mockResolvedValue({ res: true });

    montar();
    fireEvent.click(await screen.findByRole('button', { name: /no se envió/i }));
    fireEvent.click(await screen.findByRole('button', { name: /otro motivo/i }));

    await waitFor(() => expect(proveedores.noEnviado).toHaveBeenCalledWith('q1', 'p1', 'otro'));
  });

  // La recarga de después de enviar es otra búsqueda paga, con tope de 10/min:
  // si falla, la lista que el comprador ya tiene en pantalla se queda donde está.
  it('una recarga que falla no borra la lista', async () => {
    vi.mocked(proveedores.delQuodom)
      .mockResolvedValueOnce(respuesta({ proveedores: [LE_BLEU, SIN_TEL] }))
      .mockRejectedValueOnce(new Error('Estás buscando proveedores muy seguido.'));
    vi.mocked(quodom.whatsapp).mockResolvedValue({ res: true, link: 'https://wa.me/541166687854?text=hola' });

    montar();
    fireEvent.click(await screen.findByRole('button', { name: /whatsapp/i }));

    expect(await screen.findByText(/no pudimos actualizar/i)).toBeInTheDocument();
    expect(screen.getByText('Pinturerías Le Bleu')).toBeInTheDocument();
    expect(screen.getByText('JB Artículos de Limpieza')).toBeInTheDocument();
    expect(screen.getByText('Resultados de Google')).toBeInTheDocument();
  });
});
