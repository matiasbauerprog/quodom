const db = require('../helpers/db');
const { callGemini } = require('../helpers/gemini');

// Argentina is UTC-3 year-round. Use local date so the daily counter resets at
// local midnight, not at 21:00 local (UTC midnight).
function todayArgentina() {
  return new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

const INTENT_SCHEMA = {
  type: 'object',
  properties: {
    idsSubcategoria: { type: 'array', items: { type: 'integer' } }
  },
  required: ['idsSubcategoria']
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
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

  const subcats = await db.Category.findAll({
    where: { idcategoriapadre: { [db.Sequelize.Op.gt]: 0 }, activa: true },
    attributes: ['id', 'nombrecategoria', 'idcategoriapadre']
  });
  const rubros = await db.Category.findAll({
    where: { idcategoriapadre: 0, activa: true },
    attributes: ['id', 'nombrecategoria']
  });
  const rubroById = new Map(rubros.map(r => [r.id, r.nombrecategoria]));
  const subcatList = subcats.map(s => ({
    id: s.id,
    nombre: s.nombrecategoria,
    rubro: rubroById.get(s.idcategoriapadre) || ''
  }));

  const intentContents = messages.slice(-3).map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.text }]
  }));

  const intent = await callGemini({
    model,
    systemPrompt:
      'Sos un clasificador. Recibís el mensaje de un usuario que quiere armar un presupuesto de compra ' +
      'y una lista de subcategorías con su rubro padre. Devolvé un JSON con los IDs de subcategorías ' +
      'relevantes al mensaje. Si ninguna aplica, devolvé un array vacío. ' +
      'Subcategorías disponibles: ' + JSON.stringify(subcatList),
    contents: intentContents,
    responseSchema: INTENT_SCHEMA
  });

  const ids = Array.isArray(intent.idsSubcategoria) ? intent.idsSubcategoria : [];
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

  const reply = await callGemini({
    model,
    systemPrompt:
      'Sos el asistente de Quodom. Ayudás al usuario a armar un presupuesto de compra. Respondés SIEMPRE en español y en JSON. ' +
      'Si te falta información, devolvé { "type":"question", "text":"..." } con UNA sola repregunta clara. ' +
      'Cuando tengas suficiente información, devolvé { "type":"proposal", "text":"...", "items":[{"idproducto":<id>,"cantidad":<n>,"motivo":"<por qué>"}] }. ' +
      'REGLA CRÍTICA: los idproducto deben ser exclusivamente de esta lista. No inventes IDs ni nombres. ' +
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
    return { type: 'proposal', text: reply.text, items: filtered };
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
