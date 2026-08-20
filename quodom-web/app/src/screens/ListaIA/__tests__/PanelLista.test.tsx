import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PanelLista } from '../PanelLista';
import { useAuth } from '../../../auth/AuthContext';
import { listaApi } from '../../../api/lista';
import { quodom as quodomApi } from '../../../api/quodom';
import { quodomLines } from '../../../api/quodom_lines';

vi.mock('../../../auth/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../../../api/lista', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/lista')>();
  return { ...actual, listaApi: { procesar: vi.fn() } };
});
vi.mock('../../../api/quodom', () => ({
  quodom: { activoPorRubro: vi.fn(), create: vi.fn() }
}));
vi.mock('../../../api/quodom_lines', () => ({
  quodomLines: { add: vi.fn() }
}));

const mockProcesar = listaApi.procesar as unknown as ReturnType<typeof vi.fn>;
const mockActivoPorRubro = quodomApi.activoPorRubro as unknown as ReturnType<typeof vi.fn>;
const mockAdd = quodomLines.add as unknown as ReturnType<typeof vi.fn>;

const RESPUESTA = {
  res: true as const,
  grupos: [
    {
      idrubro: 1, rubro: 'Limpieza',
      items: [{ textoOriginal: '3 lavandinas', idproducto: 8001, nombreProducto: 'Lavandina 5L', cantidad: 3 }]
    },
    {
      idrubro: 2, rubro: 'Librería',
      items: [{ textoOriginal: '2 resmas', idproducto: 8002, nombreProducto: 'Resma A4 75g', cantidad: 2 }]
    }
  ],
  ambiguas: [],
  noEncontrados: [{ textoOriginal: '1 escalera', motivo: 'no está en el catálogo' }],
  lineasIgnoradas: 0
};

beforeEach(() => {
  mockProcesar.mockReset();
  mockActivoPorRubro.mockReset();
  mockAdd.mockReset();
  vi.mocked(useAuth).mockReturnValue(
    { user: { id: 'u1', nombre: 'Ana' }, signout: vi.fn() } as unknown as ReturnType<typeof useAuth>
  );
});

function renderYEnviar(respuesta: unknown = RESPUESTA) {
  mockProcesar.mockResolvedValue(respuesta);
  render(<MemoryRouter><PanelLista /></MemoryRouter>);
  fireEvent.change(screen.getByLabelText(/pegá tu lista/i), {
    target: { value: '3 lavandinas\n2 resmas\n1 escalera' }
  });
  fireEvent.click(screen.getByRole('button', { name: /buscar en el catálogo/i }));
}

describe('PanelLista', () => {
  it('muestra un grupo por rubro', async () => {
    renderYEnviar();
    await waitFor(() => expect(screen.getByText(/Limpieza/)).toBeInTheDocument());
    expect(screen.getByText(/Librería/)).toBeInTheDocument();
    expect(screen.getByText('Lavandina 5L')).toBeInTheDocument();
    expect(screen.getByText('Resma A4 75g')).toBeInTheDocument();
  });

  it('muestra los no encontrados con su texto original', async () => {
    renderYEnviar();
    await waitFor(() => expect(screen.getByRole('region', { name: /no encontr/i })).toBeInTheDocument());
    const region = screen.getByRole('region', { name: /no encontr/i });
    expect(within(region).getByText(/1 escalera/)).toBeInTheDocument();
    expect(within(region).getByText(/no está en el catálogo/)).toBeInTheDocument();
  });

  it('avisa cuántas líneas quedaron afuera', async () => {
    renderYEnviar({ ...RESPUESTA, lineasIgnoradas: 12 });
    await waitFor(() => expect(screen.getByText(/12/)).toBeInTheDocument());
  });

  it('no muestra el bloque de no encontrados cuando matcheó todo', async () => {
    renderYEnviar({ ...RESPUESTA, noEncontrados: [] });
    await waitFor(() => expect(screen.getByText(/Limpieza/)).toBeInTheDocument());
    expect(screen.queryByText(/no encontr/i)).not.toBeInTheDocument();
  });

  it('avisa cuando no matcheó nada', async () => {
    renderYEnviar({ res: true, grupos: [], ambiguas: [], noEncontrados: [], lineasIgnoradas: 0 });
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/no encontré/i));
  });

  it('confirmar un grupo no navega ni oculta los demás: el segundo grupo sigue confirmable', async () => {
    mockActivoPorRubro.mockResolvedValue({ id: 'Q-1' });
    mockAdd.mockResolvedValue(undefined);

    renderYEnviar();
    await waitFor(() => expect(screen.getByText(/Limpieza/)).toBeInTheDocument());
    expect(screen.getByText(/Librería/)).toBeInTheDocument();

    const botones = screen.getAllByRole('button', { name: /agregar al quodom/i });
    expect(botones).toHaveLength(2);

    fireEvent.click(botones[0]);

    await waitFor(() => expect(screen.getAllByText(/Agregado/)).toHaveLength(1));

    // El primer grupo quedó marcado y el segundo sigue en pantalla y confirmable:
    // la pantalla no navegó a otro lado.
    expect(screen.getByText(/Librería/)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /agregar al quodom/i })).toHaveLength(1);
    expect(mockAdd).toHaveBeenCalledTimes(1);
  });

  it('muestra el error del servidor y deja volver a intentar', async () => {
    mockProcesar.mockRejectedValue(new Error('La IA está sobrecargada en este momento.'));
    render(<MemoryRouter><PanelLista /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText(/pegá tu lista/i), { target: { value: 'lavandina' } });
    fireEvent.click(screen.getByRole('button', { name: /buscar en el catálogo/i }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/sobrecargada/i));
    expect(screen.getByRole('button', { name: /buscar en el catálogo/i })).toBeEnabled();
  });
});

describe('PanelLista (invitado)', () => {
  beforeEach(() => mockProcesar.mockClear());

  it('pide login al enviar la lista y no llama al API', async () => {
    vi.mocked(useAuth).mockReturnValue(
      { user: null, signout: vi.fn() } as unknown as ReturnType<typeof useAuth>
    );
    render(<MemoryRouter><PanelLista /></MemoryRouter>);

    fireEvent.change(screen.getByLabelText(/pegá tu lista/i), { target: { value: '3 lavandinas' } });
    fireEvent.click(screen.getByRole('button', { name: /buscar en el catálogo/i }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/iniciar sesión/i));
    expect(mockProcesar).not.toHaveBeenCalled();
  });
});

const CON_AMBIGUA = {
  res: true as const,
  grupos: [
    {
      idrubro: 1, rubro: 'Limpieza',
      items: [{ textoOriginal: '3 lavandinas', idproducto: 8001, nombreProducto: 'Lavandina 5L', cantidad: 3 }]
    }
  ],
  ambiguas: [
    {
      textoOriginal: '3 platos descartables',
      cantidad: 3,
      sugerido: 493,
      candidatos: [
        { idproducto: 455, nombreProducto: 'Plato por 10 unidades', idrubro: 3, rubro: 'Papelera' },
        { idproducto: 493, nombreProducto: 'Plato descartable por 100 unidades', idrubro: 3, rubro: 'Papelera' }
      ]
    }
  ],
  noEncontrados: [],
  lineasIgnoradas: 0
};

async function enviarCon(respuesta: unknown) {
  mockProcesar.mockResolvedValue(respuesta);
  render(<MemoryRouter><PanelLista /></MemoryRouter>);
  fireEvent.change(screen.getByLabelText(/pegá tu lista/i), { target: { value: '3 lavandinas\n3 platos descartables' } });
  fireEvent.click(screen.getByRole('button', { name: /buscar en el catálogo/i }));
}

describe('PanelLista (líneas ambiguas)', () => {
  it('muestra el bloque de elección arriba de los grupos', async () => {
    await enviarCon(CON_AMBIGUA);

    expect(await screen.findByRole('region', { name: /tenés que elegir/i })).toBeInTheDocument();
    expect(screen.getByText(/Limpieza/)).toBeInTheDocument();
    expect(screen.getAllByText(/Papelera/).length).toBeGreaterThan(0);
  });

  it('elegir un candidato lo saca del bloque y crea el grupo de su rubro', async () => {
    await enviarCon(CON_AMBIGUA);
    await screen.findByRole('region', { name: /tenés que elegir/i });

    fireEvent.click(screen.getByRole('button', { name: /plato descartable por 100 unidades/i }));

    await waitFor(() => expect(screen.queryByRole('region', { name: /tenés que elegir/i })).toBeNull());
    expect(screen.getByText('Plato descartable por 100 unidades')).toBeInTheDocument();
    expect(screen.getByText(/Papelera — 1 producto/)).toBeInTheDocument();
  });

  it('descartar una línea no la agrega a ningún grupo', async () => {
    await enviarCon(CON_AMBIGUA);
    await screen.findByRole('region', { name: /tenés que elegir/i });

    fireEvent.click(screen.getByRole('button', { name: /descartar/i }));

    await waitFor(() => expect(screen.queryByRole('region', { name: /tenés que elegir/i })).toBeNull());
    expect(screen.queryByText(/Papelera/)).toBeNull();
  });

  it('avisa en el grupo cuántas líneas quedan sin resolver', async () => {
    await enviarCon(CON_AMBIGUA);

    expect(await screen.findByText(/1 línea sin resolver/i)).toBeInTheDocument();
  });

  it('sin ambiguas no dibuja el bloque', async () => {
    await enviarCon({ ...CON_AMBIGUA, ambiguas: [] });

    await screen.findByText(/Limpieza/);
    expect(screen.queryByRole('region', { name: /tenés que elegir/i })).toBeNull();
  });
});

// El candidato cae en el rubro 1 (Limpieza), que ya trae un grupo del servidor
// y todavía no fue confirmado. Es el caso que un mount fresco de PropuestaEditable
// no ejercita: en CON_AMBIGUA el candidato va al rubro 3, que no tiene grupo
// previo, así que GrupoRubro siempre se monta de cero y el bug de FIX 1 no se ve.
const CON_AMBIGUA_MISMO_RUBRO = {
  res: true as const,
  grupos: [
    {
      idrubro: 1, rubro: 'Limpieza',
      items: [{ textoOriginal: '3 lavandinas', idproducto: 8001, nombreProducto: 'Lavandina 5L', cantidad: 3 }]
    }
  ],
  ambiguas: [
    {
      textoOriginal: '2 guantes',
      cantidad: 2,
      sugerido: 8010,
      candidatos: [
        { idproducto: 8010, nombreProducto: 'Guantes de látex', idrubro: 1, rubro: 'Limpieza' },
        { idproducto: 8011, nombreProducto: 'Guantes descartables', idrubro: 3, rubro: 'Papelera' }
      ]
    }
  ],
  noEncontrados: [],
  lineasIgnoradas: 0
};

describe('PanelLista (ambigua resuelve a un grupo existente sin confirmar)', () => {
  it('el producto resuelto aparece en el grupo de su rubro que ya traía el servidor', async () => {
    await enviarCon(CON_AMBIGUA_MISMO_RUBRO);
    await screen.findByRole('region', { name: /tenés que elegir/i });

    fireEvent.click(screen.getByRole('button', { name: /guantes de látex/i }));

    await waitFor(() => expect(screen.queryByRole('region', { name: /tenés que elegir/i })).toBeNull());
    expect(screen.getByText('Guantes de látex')).toBeInTheDocument();
    expect(screen.getByText('Lavandina 5L')).toBeInTheDocument();
    expect(screen.getByText(/Limpieza — 2 productos/)).toBeInTheDocument();
  });
});

// El candidato resuelve al mismo idproducto que ya está en el grupo (Lavandina
// 5L, id 8001): tiene que fusionarse en vez de duplicar la fila.
//
// Es una función y no un objeto compartido porque el merge de PanelLista muta
// en el lugar el item que ya trajo el servidor (`existente.cantidad += ...`):
// un const reusado entre tests quedaría con la cantidad ya sumada de un test
// anterior y el segundo test arrancaría de una base equivocada.
function crearListaMismoProducto() {
  return {
    res: true as const,
    grupos: [
      {
        idrubro: 1, rubro: 'Limpieza',
        items: [{ textoOriginal: '3 lavandinas', idproducto: 8001, nombreProducto: 'Lavandina 5L', cantidad: 3 }]
      }
    ],
    ambiguas: [
      {
        textoOriginal: '2 lavandinas más',
        cantidad: 2,
        sugerido: 8001,
        candidatos: [
          { idproducto: 8001, nombreProducto: 'Lavandina 5L', idrubro: 1, rubro: 'Limpieza' },
          { idproducto: 8020, nombreProducto: 'Lavandina 3L', idrubro: 1, rubro: 'Limpieza' }
        ]
      }
    ],
    noEncontrados: [],
    lineasIgnoradas: 0
  };
}

describe('PanelLista (ambigua resuelve al mismo producto de un grupo existente)', () => {
  it('suma la cantidad en vez de duplicar la fila', async () => {
    await enviarCon(crearListaMismoProducto());
    const region = await screen.findByRole('region', { name: /tenés que elegir/i });

    fireEvent.click(within(region).getByRole('button', { name: /lavandina 5l/i }));

    await waitFor(() => expect(screen.queryByRole('region', { name: /tenés que elegir/i })).toBeNull());
    // Sin el merge esto sería "8001-8001" en vez de "8001": dos filas con el
    // mismo idproducto (misma key de React) en vez de una sola fusionada.
    expect(screen.getAllByText('Lavandina 5L')).toHaveLength(1);
    expect(screen.getByText(/Limpieza — 1 producto/)).toBeInTheDocument();
  });

  it('el input de cantidad muestra la suma fusionada, y confirmar manda esa cantidad', async () => {
    mockActivoPorRubro.mockResolvedValue({ id: 'Q-1' });
    mockAdd.mockResolvedValue(undefined);

    await enviarCon(crearListaMismoProducto());
    const region = await screen.findByRole('region', { name: /tenés que elegir/i });

    fireEvent.click(within(region).getByRole('button', { name: /lavandina 5l/i }));

    await waitFor(() => expect(screen.queryByRole('region', { name: /tenés que elegir/i })).toBeNull());

    // La cantidad fusionada (3 del servidor + 2 de la ambigua resuelta) tiene que
    // llegar al input que dibuja PropuestaEditable, no quedar en su copia vieja de
    // antes de la fusión (el título del grupo no lo distingue: sigue diciendo
    // "1 producto" en los dos casos).
    const input = await screen.findByLabelText(/cantidad de lavandina 5l/i) as HTMLInputElement;
    expect(input.value).toBe('5');

    fireEvent.click(screen.getByRole('button', { name: /agregar al quodom/i }));

    await waitFor(() => expect(mockAdd).toHaveBeenCalledTimes(1));
    // Esto es lo que efectivamente llega al Quodom del usuario: si quedó la
    // cantidad vieja, el Quodom se guarda con menos de lo que el usuario pidió.
    expect(mockAdd).toHaveBeenCalledWith(expect.objectContaining({ idproducto: 8001, cantidad: 5 }));
  });
});

// Segunda ambigua, en otro rubro, que no toca el producto fusionado: resolverla
// sólo sirve para forzar un re-render de PanelLista sin que el usuario haga nada
// más sobre la línea de lavandinas.
function crearListaMismoProductoConSegundaAmbigua() {
  const base = crearListaMismoProducto();
  return {
    ...base,
    ambiguas: [
      ...base.ambiguas,
      {
        textoOriginal: '1 escoba',
        cantidad: 1,
        sugerido: 9001,
        candidatos: [
          { idproducto: 9001, nombreProducto: 'Pala', idrubro: 5, rubro: 'Bazar' },
          { idproducto: 9002, nombreProducto: 'Rastrillo', idrubro: 5, rubro: 'Bazar' }
        ]
      }
    ]
  };
}

describe('PanelLista (un re-render ajeno no vuelve a sumar la cantidad fusionada)', () => {
  it('resolver una segunda ambigua no le suma la cantidad otra vez a la primera', async () => {
    await enviarCon(crearListaMismoProductoConSegundaAmbigua());
    const region = await screen.findByRole('region', { name: /tenés que elegir/i });

    // Resuelve la línea que se fusiona con el producto ya pendiente en el grupo.
    fireEvent.click(within(region).getByRole('button', { name: /lavandina 5l/i }));
    await waitFor(async () => {
      const input = await screen.findByLabelText(/cantidad de lavandina 5l/i) as HTMLInputElement;
      expect(input.value).toBe('5');
    });

    // Resuelve una segunda línea, sin relación con la primera: esto re-renderiza
    // PanelLista y vuelve a correr el merge sobre las ambiguas ya resueltas. Si el
    // merge muta el item en el lugar, la cantidad fusionada de la lavandina sube
    // sola a 7 (5 + 2 de vuelta) sin que el usuario haya tocado esa línea.
    fireEvent.click(screen.getByRole('button', { name: /^pala/i }));
    await waitFor(() => expect(screen.queryByRole('region', { name: /tenés que elegir/i })).toBeNull());

    const input = await screen.findByLabelText(/cantidad de lavandina 5l/i) as HTMLInputElement;
    expect(input.value).toBe('5');
  });
});

describe('PanelLista (una segunda carga no hereda el estado de la primera)', () => {
  it('un rubro y producto repetidos entre dos cargas vuelven a ser confirmables', async () => {
    mockActivoPorRubro.mockResolvedValue({ id: 'Q-1' });
    mockAdd.mockResolvedValue(undefined);

    renderYEnviar();
    await waitFor(() => expect(screen.getByText(/Limpieza/)).toBeInTheDocument());

    const botones = screen.getAllByRole('button', { name: /agregar al quodom/i });
    fireEvent.click(botones[0]);
    await waitFor(() => expect(screen.getAllByText(/Agregado/)).toHaveLength(1));

    mockProcesar.mockResolvedValue({
      res: true,
      grupos: [
        {
          idrubro: 1, rubro: 'Limpieza',
          items: [{ textoOriginal: '5 lavandinas', idproducto: 8001, nombreProducto: 'Lavandina 5L', cantidad: 5 }]
        }
      ],
      ambiguas: [],
      noEncontrados: [],
      lineasIgnoradas: 0
    });
    fireEvent.change(screen.getByLabelText(/pegá tu lista/i), { target: { value: '5 lavandinas' } });
    fireEvent.click(screen.getByRole('button', { name: /buscar en el catálogo/i }));

    await waitFor(() => expect(screen.getAllByRole('button', { name: /agregar al quodom/i })).toHaveLength(1));
    expect(screen.queryByText(/Agregado/)).toBeNull();
  });
});
