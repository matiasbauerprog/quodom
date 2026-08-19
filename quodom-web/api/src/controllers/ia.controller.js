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
          motivo: { type: 'string' }
        },
        required: ['idproducto', 'cantidad']
      }
    }
  },
  required: ['type', 'text']
};

async function chat(userId, messages) {
  const model = process.env.GEMINI_MODEL || 'gemini-flash-latest';
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

  const productos = await db.Products.findAll({
    where: { categoria: { [db.Sequelize.Op.in]: ids } },
    attributes: ['id', 'nombreproducto', 'atributo1', 'atributo2', 'categoria']
  });

  if (productos.length === 0) {
    return { type: 'question', text: '¿De qué rubro es tu proyecto? Contame un poco más para poder ayudarte.' };
  }

  const productoIndex = new Map(productos.map(p => [p.id, p]));
  const productList = productos.map(p => ({
    idproducto: p.id,
    nombre: p.nombreproducto,
    atributo1: p.atributo1 || null,
    atributo2: p.atributo2 || null
  }));

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
      '3. NUNCA adivines atributos del usuario como color, tamaño, marca, terminación o categoría de precio. ' +
      'Si un producto tiene atributos (los verás como "atributo1" y "atributo2" en la lista), esos DEBE elegirlos el usuario — preguntáselo.\n' +
      '4. Hacé UNA sola pregunta por turno, clara y concreta. No amontones varias preguntas.\n' +
      '5. Cuando finalmente propongas, en "motivo" incluí el cálculo o razón concreta ' +
      '(ej. "3 latas de 4L para cubrir 36m² a 2 manos, cada lata rinde 12m² por mano").\n' +
      '6. Esta conversación es sólo del rubro "' + (rubroById.get(idrubro) || '') + '": si el proyecto que ' +
      'describe el usuario abarca además otros rubros (ej. pintura y bebidas para la misma obra), NO los mezcles ' +
      'en la propuesta. Repreguntá por cuál rubro arrancar primero y seguí sólo con ese.\n\n' +
      'GUÍAS POR RUBRO (adaptá al proyecto del usuario):\n' +
      '- Pintura: preguntá si las paredes están enduidas/preparadas, si es cocina/baño (necesita antihongo), interior o exterior, cuántas manos, color deseado, si tiene humedad.\n' +
      '- Construcción en seco (Durlock/placas): tipo de proyecto (tabique/cielorraso/revestimiento), medidas totales, si necesita aislación térmica o acústica.\n' +
      '- Electricidad: tipo de instalación, cantidad de bocas/puntos, longitud aproximada de cableado, potencia esperada.\n' +
      '- Plomería: tipo de instalación (agua fría/caliente/cloacal), diámetros necesarios, longitud de la tirada, tipo de uniones.\n' +
      '- Otros rubros: usá criterio experto pero SIEMPRE preguntá antes de asumir.\n\n' +
      'FORMATO DE RESPUESTA (siempre uno de dos):\n' +
      '- Repregunta: { "type":"question", "text":"UNA sola pregunta concreta" }\n' +
      '- Propuesta: { "type":"proposal", "text":"resumen breve", "items":[{"idproducto":<id>,"cantidad":<n>,"motivo":"<cálculo/razón>"}] }\n\n' +
      'CONTEXTO DE ESTA CONVERSACIÓN: llevás ' + assistantTurns + ' respuesta(s) previa(s) en este chat. ' +
      (assistantTurns < 2 ? 'Aún NO estás autorizado a proponer productos: solo repreguntá.' : 'Ya podés proponer si tenés información suficiente.') + '\n\n' +
      'REGLA CRÍTICA DE PRODUCTOS: los idproducto deben ser exclusivamente de esta lista. No inventes IDs ni nombres. ' +
      'Productos disponibles: ' + JSON.stringify(productList),
    contents: geminiContents,
    responseSchema: CHAT_SCHEMA
  });

  if (reply.type === 'proposal') {
    const rawItems = Array.isArray(reply.items) ? reply.items : [];
    const filtered = [];
    for (const it of rawItems) {
      const p = productoIndex.get(it.idproducto);
      if (!p) continue;
      filtered.push({
        idproducto: p.id,
        cantidad: Math.max(1, Number(it.cantidad) || 1),
        motivo: typeof it.motivo === 'string' ? it.motivo : '',
        nombreProducto: p.nombreproducto
      });
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
