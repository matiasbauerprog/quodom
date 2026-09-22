const fs = require('fs');
const path = require('path');
const db = require('../helpers/db');
const { callGemini } = require('../helpers/gemini');
const { RUBROS_ACTIVOS } = require('../config/rubros');

// Argentina is UTC-3 year-round. Use local date so the daily counter resets at
// local midnight, not at 21:00 local (UTC midnight).
function todayArgentina() {
  return new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

const INTENT_SCHEMA = {
  type: 'object',
  properties: {
    idrubro: { type: 'integer' },
    idsSubcategoria: { type: 'array', items: { type: 'integer' } }
  },
  required: ['idrubro', 'idsSubcategoria']
};

const CHAT_SCHEMA = {
  type: 'object',
  properties: {
    type: { type: 'string', enum: ['question', 'proposal'] },
    text: { type: 'string' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          idproducto: { type: 'integer' },
          cantidad: { type: 'integer' },
          // Una línea para el usuario. El largo va declarado acá además de
          // pedirse en el prompt, pero el corte que manda es el del servidor
          // (motivoAcotado): el modelo ya desbordó este campo una vez.
          motivo: { type: 'string', maxLength: 160 },
          // El valor elegido para cada grupo de atributos del producto
          // ("20 litros" para LITROS). Opcional: una línea sin atributo es
          // válida y se completa después en el detalle del Quodom.
          atributo1: { type: 'string' },
          atributo2: { type: 'string' }
        },
        required: ['idproducto', 'cantidad']
      }
    }
  },
  required: ['type', 'text']
};

async function chat(userId, messages) {
  // Ver DEFAULT_FALLBACKS en helpers/gemini.js: el default no es el modelo más
  // nuevo sino el que efectivamente contesta en el free tier.
  const model = process.env.GEMINI_MODEL || 'gemini-3-flash-preview';
  // The intent step is plain classification: run it on a lighter model so a chat
  // turn only puts one request on the (often congested) main model.
  const intentModel = process.env.GEMINI_MODEL_INTENT || 'gemini-flash-lite-latest';

  // Sólo los rubros habilitados: lo que el modelo no ve, no lo puede proponer.
  const subcats = await db.Category.findAll({
    where: { idcategoriapadre: { [db.Sequelize.Op.in]: RUBROS_ACTIVOS }, activa: true },
    attributes: ['id', 'nombrecategoria', 'idcategoriapadre']
  });
  const rubros = await db.Category.findAll({
    where: { idcategoriapadre: 0, activa: true, id: { [db.Sequelize.Op.in]: RUBROS_ACTIVOS } },
    attributes: ['id', 'nombrecategoria']
  });
  const rubroById = new Map(rubros.map(r => [r.id, r.nombrecategoria]));
  const subcatPorId = new Map(subcats.map(s => [s.id, { idrubro: s.idcategoriapadre, nombre: s.nombrecategoria }]));
  const subcatList = subcats.map(s => ({
    id: s.id,
    nombre: s.nombrecategoria,
    idrubro: s.idcategoriapadre,
    rubro: rubroById.get(s.idcategoriapadre) || ''
  }));

  const intentContents = messages.slice(-3).map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.text }]
  }));

  const intent = await callGemini({
    model: intentModel,
    systemPrompt:
      'Sos un clasificador. Recibís el mensaje de un usuario que quiere armar un presupuesto de compra ' +
      'y una lista de subcategorías, cada una con el id del rubro (categoría padre) al que pertenece. ' +
      'Un presupuesto (Quodom) es siempre de un solo rubro: devolvé el id del rubro más relevante para el ' +
      'mensaje ("idrubro") y sólo las subcategorías de ESE rubro que apliquen ("idsSubcategoria"). ' +
      'Si el mensaje abarca varios rubros, elegí el principal. Si ninguna subcategoría aplica, devolvé ' +
      'idsSubcategoria como array vacío (igual indicá el idrubro más probable). ' +
      'Subcategorías disponibles: ' + JSON.stringify(subcatList),
    contents: intentContents,
    responseSchema: INTENT_SCHEMA
  });

  const idrubro = intent.idrubro;
  const ids = Array.isArray(intent.idsSubcategoria)
    ? intent.idsSubcategoria.filter(id => subcatPorId.get(id)?.idrubro === idrubro)
    : [];
  if (ids.length === 0) {
    return { type: 'question', text: '¿De qué rubro es tu proyecto? Contame un poco más para poder ayudarte.' };
  }

  // Las subcategorías del clasificador sirven para saber que entendió el rubro,
  // NO para recortar el catálogo: al pedir "pintar una casa" devolvía Látex y
  // Superficie, y como los pinceles y rodillos viven en Accesorios, la propuesta
  // salía sin con qué aplicar la pintura. Se manda el rubro entero, que desde
  // que el catálogo va comprimido cuesta menos que lo que costaba el recorte.
  const idsDelRubro = subcatList.filter(s => s.idrubro === idrubro).map(s => s.id);

  const productos = await db.Products.findAll({
    where: { categoria: { [db.Sequelize.Op.in]: idsDelRubro } },
    attributes: ['id', 'nombreproducto', 'atributo1', 'atributo2', 'categoria']
  });

  if (productos.length === 0) {
    return { type: 'question', text: '¿De qué rubro es tu proyecto? Contame un poco más para poder ayudarte.' };
  }

  const productoIndex = new Map(productos.map(p => [p.id, p]));

  // Los valores elegibles de cada atributo viven en productos_atributos, no en
  // productos: `productos.atributo1` es sólo el NOMBRE del grupo ("LITROS").
  // Sin esto el modelo no tiene forma de saber que existe la lata de 20 litros.
  // Se agrupa por nombreatributo, nunca por idatributo (el mismo id es MEDIDAS
  // en un producto y PESO en otro).
  const opcionesPorProducto = await cargarOpcionesAtributos(productos.map(p => p.id));
  const opcionesDe = (p, slot) => {
    const nombre = slot === 1 ? p.atributo1 : p.atributo2;
    if (!nombre) return null;
    const valores = opcionesPorProducto.get(p.id)?.get(nombre);
    return valores && valores.length > 0 ? { nombre, valores } : null;
  };

  const catalogo = catalogoParaPrompt(productos, opcionesDe);

  const geminiContents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.text }]
  }));

  const assistantTurns = messages.filter(m => m.role === 'assistant').length;

  const reply = await callGemini({
    model,
    systemPrompt:
      'Sos el asistente de Quodom, un experto en armar presupuestos de materiales de construcción, pintura, ferretería y afines. ' +
      'Respondés SIEMPRE en español y en JSON.\n\n' +
      'REGLAS ESTRICTAS DE COMPORTAMIENTO:\n' +
      '1. NUNCA propongas productos en tu primera respuesta. Empezá siempre con una repregunta.\n' +
      '2. Antes de proponer, tenés que hacer al menos DOS repreguntas útiles cubriendo: ' +
      'alcance del proyecto (medidas, cantidad, superficie), estado actual del sustrato, condiciones (interior/exterior, húmedo/seco), y preferencias del usuario.\n' +
      '3. ATRIBUTOS: cada producto de la lista puede traer "atributos", con el nombre del grupo (ej. "LITROS") ' +
      'y sus valores posibles. Al proponer podés completar "atributo1" y/o "atributo2" con UNO de esos valores, ' +
      'copiado EXACTAMENTE como figura en la lista. Completalo sólo cuando se desprende de la conversación: ' +
      'el formato o la medida que surge de tu propio cálculo (proponés 20 litros porque calculaste 20L de rendimiento), ' +
      'o lo que el usuario ya dijo. NUNCA adivines lo que es preferencia del usuario y no te dijo ' +
      '(marca, color, terminación, categoría de precio): dejá ese atributo vacío o preguntáselo. ' +
      'Dejar un atributo vacío es válido, el usuario lo completa después.\n' +
      '3bis. La misma regla vale cuando el catálogo separa el gusto en productos DISTINTOS, no en atributos: ' +
      'si dos productos se diferencian sólo en algo que elige el usuario — terminación (mate o satinado), ' +
      'color, variedad, sabor — no elijas vos, preguntá cuál quiere. Si el catálogo ofrece una sola ' +
      'variante, usala sin preguntar: no es una elección.\n' +
      '4. Hacé UNA sola pregunta por turno, clara y concreta. No amontones varias preguntas.\n' +
      '5. "motivo" es UNA sola oración corta (máximo 160 caracteres) que el usuario lee debajo del producto: ' +
      'la cuenta ya resuelta, en limpio (ej. "3 latas de 4L para 36m² a 2 manos; cada lata rinde 12m² por mano"). ' +
      'NO es un borrador: no escribas ahí tu razonamiento, ni alternativas, ni "recalculando", ni te corrijas. ' +
      'Decidí antes y escribí sólo la conclusión. Un "motivo" largo te deja sin espacio para el resto de los ítems.\n' +
      '6. NUNCA sustituyas en silencio. Si el usuario pidió algo concreto — un color, una marca, una ' +
      'medida, un formato — y el catálogo no lo tiene, decílo con todas las letras en "text" y ofrecé la ' +
      'alternativa más parecida o repreguntá. Entregarle otra cosa parecida sin avisar es el peor error ' +
      'que podés cometer: el usuario cree que le diste lo que pidió.\n' +
      '7. Esta conversación es sólo del rubro "' + (rubroById.get(idrubro) || '') + '": si el proyecto que ' +
      'describe el usuario abarca además otros rubros (ej. pintura y bebidas para la misma obra), NO los mezcles ' +
      'en la propuesta. Repreguntá por cuál rubro arrancar primero y seguí sólo con ese.\n\n' +
      'GUÍA DEL RUBRO DE ESTA CONVERSACIÓN: ' + guiaDeRubro(idrubro) + '\n\n' +
      'FORMATO DE RESPUESTA (siempre uno de dos):\n' +
      '- Repregunta: { "type":"question", "text":"UNA sola pregunta concreta" }\n' +
      '- Propuesta: { "type":"proposal", "text":"resumen breve", "items":[{"idproducto":<id>,"cantidad":<n>,' +
      '"motivo":"<una oración corta>","atributo1":"<valor exacto o vacío>","atributo2":"<valor exacto o vacío>"}] }\n\n' +
      'CONTEXTO DE ESTA CONVERSACIÓN: llevás ' + assistantTurns + ' respuesta(s) previa(s) en este chat. ' +
      (assistantTurns < 2 ? 'Aún NO estás autorizado a proponer productos: solo repreguntá.' : 'Ya podés proponer si tenés información suficiente.') + '\n\n' +
      'REGLA CRÍTICA DE PRODUCTOS: los idproducto deben ser exclusivamente de esta lista. No inventes IDs ni nombres.\n\n' +
      catalogo,
    contents: geminiContents,
    responseSchema: CHAT_SCHEMA
  });

  if (reply.type === 'proposal') {
    const rawItems = Array.isArray(reply.items) ? reply.items : [];
    const filtered = [];
    for (const it of rawItems) {
      const p = productoIndex.get(it.idproducto);
      if (!p) continue;
      const item = {
        idproducto: p.id,
        cantidad: Math.max(1, Number(it.cantidad) || 1),
        motivo: motivoAcotado(it.motivo),
        nombreProducto: p.nombreproducto
      };
      // Mismo criterio que con los idproducto inventados: un valor que el
      // producto no ofrece se descarta en silencio y la línea queda sin
      // atributo, que es un estado válido.
      for (const slot of [1, 2]) {
        const grupo = opcionesDe(p, slot);
        if (!grupo) continue;
        item['nombreAtributo' + slot] = grupo.nombre;
        item['atributo' + slot] = valorValido(it['atributo' + slot], grupo.valores);
        item['opcionesAtributo' + slot] = grupo.valores;
      }
      filtered.push(item);
    }
    if (filtered.length === 0) {
      return {
        type: 'question',
        text: 'No encontré productos del catálogo para eso. ¿Podés contarme más de qué tipo de proyecto es?'
      };
    }
    return { type: 'proposal', text: reply.text, items: filtered, idrubro };
  }

  return { type: 'question', text: reply.text };
}

// Una conversación es siempre de un solo rubro, así que mandar el conocimiento
// de todos es pagar tokens por instrucciones que no aplican. Se manda el del
// rubro detectado y nada más.
//
// La guía tiene dos fuentes y conviene no mezclarlas:
//
// 1. src/config/guias/<idrubro>.txt — el conocimiento del negocio, que escribe
//    el usuario en "informacion para la ia/<Rubro>/Listado_*.xlsx" y se
//    convierte con `npm run guias`. Trae los supuestos de cálculo y los
//    ejemplos resueltos. Medido: sin los ejemplos el asistente se olvidaba el
//    esmalte de las aberturas y la mitad de los accesorios; con UNO solo
//    copiaba su escala, y con dos de distinto tamaño interpola bien.
//
// 2. NOTAS_DEL_CATALOGO — hechos de ESTE catálogo que no están en las planillas
//    del usuario y que el asistente no puede deducir de los nombres de los
//    productos. Vive en código porque describe los datos, no el oficio. Si
//    alguna vez pasa a las planillas, se borra de acá.
const GUIA_GENERICA = 'Usá criterio experto del rubro, pero SIEMPRE preguntá antes de asumir.';

const NOTAS_DEL_CATALOGO = {
  5: 'NOTAS DE ESTE CATÁLOGO (además de lo anterior):\n'
    + '- COLOR: el látex de paredes y cielorrasos existe SÓLO EN BLANCO y no hay entonadores ni '
    + 'tintes para teñirlo. No preguntes de qué color quiere las paredes y no le prometas ninguno. '
    + 'Si pide un color, decíselo de entrada y preguntale si quiere seguir igual. Los esmaltes '
    + 'sintéticos sí vienen en varios colores, y ahí el color se elige como atributo del producto.\n'
    + '- Preguntá también si es cocina o baño, porque necesita antihongo.\n'
    + '- Elegí el envase que menos sobre y menos falte: conviene una lata grande a muchas chicas.'
};

const GUIAS = cargarGuias();

function cargarGuias() {
  const dir = path.join(__dirname, '..', 'config', 'guias');
  const guias = {};
  let archivos = [];
  try {
    archivos = fs.readdirSync(dir);
  } catch {
    return guias;  // sin guías generadas el asistente sigue andando, con menos oficio
  }
  for (const archivo of archivos) {
    const id = Number(path.basename(archivo, '.txt'));
    if (!Number.isInteger(id)) continue;
    guias[id] = fs.readFileSync(path.join(dir, archivo), 'utf8').trim();
  }
  return guias;
}

function guiaDeRubro(idrubro) {
  const partes = [GUIAS[idrubro], NOTAS_DEL_CATALOGO[idrubro]].filter(Boolean);
  return partes.length > 0 ? partes.join('\n\n') : GUIA_GENERICA;
}

/**
 * El catálogo para el prompt, en texto plano y con los valores de atributos
 * declarados una sola vez.
 *
 * En JSON, y repitiendo la lista de valores en cada producto, los atributos se
 * llevaban casi la mitad del prompt: muchos productos comparten exactamente el
 * mismo juego ("1 litro|4 litros|10 litros|20 litros" se repetía en cada
 * pintura). Declararlo una vez y referenciarlo por código recorta ~70% esa
 * parte, y se paga por token en cada turno.
 *
 * El separador es "|": el catálogo real tiene valores con barra (1 1/2") y con
 * coma decimal (3,8 mts), así que usar "/" o "," partiría esos valores al medio
 * y el modelo elegiría algo que después el servidor descarta. JSON tampoco
 * servía tal cual, porque escapa las comillas de las pulgadas.
 */
function catalogoParaPrompt(productos, opcionesDe) {
  const codigoPorJuego = new Map();
  const declaraciones = [];
  const lineas = [];

  for (const p of productos) {
    const codigos = [];
    for (const slot of [1, 2]) {
      const grupo = opcionesDe(p, slot);
      if (!grupo) continue;
      const juego = grupo.nombre + ': ' + grupo.valores.join('|');
      if (!codigoPorJuego.has(juego)) {
        const codigo = 'A' + (codigoPorJuego.size + 1);
        codigoPorJuego.set(juego, codigo);
        declaraciones.push(codigo + '=' + juego);
      }
      codigos.push(codigoPorJuego.get(juego));
    }
    lineas.push(p.id + '|' + p.nombreproducto + '|' + codigos.join(' '));
  }

  const cabecera = declaraciones.length > 0
    ? 'ATRIBUTOS (cada código agrupa los valores posibles de un atributo):\n'
      + declaraciones.join('\n') + '\n\n'
    : '';

  return cabecera
    + 'PRODUCTOS (idproducto|nombre|códigos de atributos que aplican, en orden: '
    + 'el primero es "atributo1" y el segundo "atributo2"):\n'
    + lineas.join('\n');
}

/**
 * Valores elegibles por producto y por nombre de grupo, en el orden del
 * catálogo. Los `esvendedor: '1'` quedan afuera: son del lado vendedor, que en
 * esta webapp no existe.
 */
async function cargarOpcionesAtributos(idsProducto) {
  const filas = await db.productos_atributos.findAll({
    where: { idproducto: { [db.Sequelize.Op.in]: idsProducto }, esvendedor: '0' },
    order: [['orden', 'ASC']],
    attributes: ['idproducto', 'nombreatributo', 'valoratributo']
  });
  const porProducto = new Map();
  for (const f of filas) {
    if (!f.nombreatributo || !f.valoratributo) continue;
    if (!porProducto.has(f.idproducto)) porProducto.set(f.idproducto, new Map());
    const grupos = porProducto.get(f.idproducto);
    if (!grupos.has(f.nombreatributo)) grupos.set(f.nombreatributo, []);
    grupos.get(f.nombreatributo).push(f.valoratributo);
  }
  return porProducto;
}

// "motivo" es una línea que el usuario lee debajo del producto, no un borrador.
// El modelo lo usó una vez para deliberar en voz alta — alternativas,
// recálculos y al final un bucle degenerado — y con eso agotó su presupuesto de
// salida en el primer ítem, así que la propuesta llegó con un producto en vez
// de once. El prompt pide una sola oración y el esquema declara el largo, pero
// ninguna de las dos cosas es una garantía del lado del modelo: el corte acá sí.
const MOTIVO_MAX = 200;

function motivoAcotado(motivo) {
  if (typeof motivo !== 'string') return '';
  const limpio = motivo.replace(/\s+/g, ' ').trim();
  if (limpio.length <= MOTIVO_MAX) return limpio;
  const cortado = limpio.slice(0, MOTIVO_MAX - 1);
  const ultimoEspacio = cortado.lastIndexOf(' ');
  return (ultimoEspacio > MOTIVO_MAX / 2 ? cortado.slice(0, ultimoEspacio) : cortado).trimEnd() + '…';
}

/** Devuelve el valor tal cual figura en el catálogo, o null si no es uno de ellos. */
function valorValido(elegido, valores) {
  if (typeof elegido !== 'string') return null;
  const buscado = elegido.trim().toLowerCase();
  if (buscado === '') return null;
  return valores.find(v => v.trim().toLowerCase() === buscado) || null;
}

async function incrementDaily(userId) {
  const today = todayArgentina();
  const [row, created] = await db.ia_usage.findOrCreate({
    where: { iduser: userId, fecha: today },
    defaults: { iduser: userId, fecha: today, contador: 1 }
  });
  if (!created) {
    row.contador += 1;
    await row.save();
  }
  return row.contador;
}

async function getDailyCount(userId) {
  const today = todayArgentina();
  const row = await db.ia_usage.findOne({ where: { iduser: userId, fecha: today } });
  return row ? row.contador : 0;
}

module.exports = { chat, incrementDaily, getDailyCount };
