const { callGemini } = require('../helpers/gemini');
const { catalogoActivo } = require('../helpers/catalogoActivo');
const { normalizar } = require('../helpers/listaEntrada');

const LISTA_SCHEMA = {
    type: 'object',
    properties: {
        items: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    textoOriginal: { type: 'string' },
                    idproducto: { type: 'integer' },
                    cantidad: { type: 'integer' }
                },
                required: ['textoOriginal', 'idproducto', 'cantidad']
            }
        },
        noEncontrados: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    textoOriginal: { type: 'string' },
                    motivo: { type: 'string' }
                },
                required: ['textoOriginal']
            }
        },
        ambiguas: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    textoOriginal: { type: 'string' },
                    cantidad: { type: 'integer' },
                    sugerido: { type: 'integer' },
                    candidatos: { type: 'array', items: { type: 'integer' } }
                },
                required: ['textoOriginal', 'candidatos']
            }
        }
    },
    required: ['items', 'ambiguas', 'noEncontrados']
};

function maxLineas() {
    const v = parseInt(process.env.IA_LISTA_MAX_LINEAS || '150', 10);
    return Number.isFinite(v) && v > 0 ? v : 150;
}

// Para comparar lo que devolvió el modelo con lo que se le mandó: el modelo
// suele reescribir espacios y mayúsculas aunque se le pida el texto original.
function clave(texto) {
    return String(texto || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function systemPrompt(catalogo) {
    return 'Sos el buscador de listas de Quodom. Recibís la lista de compras de un usuario y ' +
        'tenés que encontrar cada ítem en el catálogo. Respondés SIEMPRE en español y en JSON.\n\n' +
        'REGLAS ESTRICTAS:\n' +
        '1. NO agregues productos que el usuario no pidió. No sugieras nada. No completes la lista.\n' +
        '2. NO inventes idproducto ni nombres: usá exclusivamente los ids de la lista de abajo.\n' +
        '3. TODA línea de la lista del usuario tiene que aparecer en "items", "ambiguas" o "noEncontrados". ' +
        'No descartes ninguna en silencio.\n' +
        '4. En "textoOriginal" copiá el renglón del usuario tal cual lo leíste, sin reescribirlo.\n' +
        '5. Si el usuario no aclara cantidad, poné 1.\n' +
        '6. Si un renglón no existe en el catálogo, va a "noEncontrados" con un "motivo" corto y concreto.\n' +
        '7. No elijas color, medida ni terminación: eso lo completa el usuario después.\n' +
        '8. Si un renglón es claramente un encabezado de columna de una planilla (por ejemplo ' +
        '"Cantidad Producto" o "Descripción") y no un producto, va a "noEncontrados" con motivo "encabezado".\n' +
        '9. Si un renglón corresponde a VARIOS productos del catálogo que responden igual de bien ' +
        '(por ejemplo "platos descartables" cuando hay platos de cartón, de aluminio y de plástico), ' +
        'NO elijas uno en silencio: devolvelo en "ambiguas" con hasta 3 "candidatos" (sus idproducto) ' +
        'y "sugerido" con el que te parece mejor. Si el renglón es preciso, resolvelo en "items": ' +
        'la ambigüedad no es una excusa para no decidir.\n\n' +
        'Productos disponibles: ' + JSON.stringify(
            catalogo.map(p => ({ idproducto: p.id, nombre: p.nombre }))
        );
}

async function procesarLista(entrada) {
    const limite = maxLineas();
    const { parts, lineas, ignoradas } = normalizar(entrada, limite);
    const catalogo = await catalogoActivo();
    const porId = new Map(catalogo.map(p => [p.id, p]));

    const reply = await callGemini({
        model: process.env.GEMINI_MODEL || 'gemini-flash-latest',
        systemPrompt: systemPrompt(catalogo),
        contents: [{ role: 'user', parts }],
        responseSchema: LISTA_SCHEMA
    });

    // Un solo array plano primero: así el recorte de foto/PDF se aplica una vez
    // y la agrupación trabaja sobre lo que ya quedó adentro del límite.
    const resueltos = [];
    const vistos = new Set();

    for (const it of Array.isArray(reply.items) ? reply.items : []) {
        const textoOriginal = String(it.textoOriginal || '').trim();
        vistos.add(clave(textoOriginal));
        const producto = porId.get(it.idproducto);
        if (!producto) {
            resueltos.push({ textoOriginal, motivo: 'no está en el catálogo' });
            continue;
        }
        resueltos.push({
            textoOriginal,
            idproducto: producto.id,
            nombreProducto: producto.nombre,
            cantidad: Math.max(1, Number(it.cantidad) || 1),
            idrubro: producto.idrubro,
            rubro: producto.rubro
        });
    }

    for (const a of Array.isArray(reply.ambiguas) ? reply.ambiguas : []) {
        const textoOriginal = String(a.textoOriginal || '').trim();
        vistos.add(clave(textoOriginal));

        // Se validan primero y se recorta después: si el modelo manda cinco y
        // los dos primeros no existen, igual quedan tres candidatos reales.
        const candidatos = [];
        for (const id of Array.isArray(a.candidatos) ? a.candidatos : []) {
            const producto = porId.get(id);
            if (!producto) continue;
            if (candidatos.some(c => c.idproducto === producto.id)) continue;
            candidatos.push({
                idproducto: producto.id,
                nombreProducto: producto.nombre,
                idrubro: producto.idrubro,
                rubro: producto.rubro
            });
            if (candidatos.length === 3) break;
        }

        const cantidad = Math.max(1, Number(a.cantidad) || 1);

        if (candidatos.length === 0) {
            resueltos.push({ textoOriginal, motivo: 'no está en el catálogo' });
            continue;
        }

        // Elegir entre una sola opción no es elegir: baja directo a su grupo.
        if (candidatos.length === 1) {
            const unico = candidatos[0];
            resueltos.push({
                textoOriginal,
                idproducto: unico.idproducto,
                nombreProducto: unico.nombreProducto,
                cantidad,
                idrubro: unico.idrubro,
                rubro: unico.rubro
            });
            continue;
        }

        const sugerido = candidatos.some(c => c.idproducto === a.sugerido)
            ? a.sugerido
            : candidatos[0].idproducto;

        resueltos.push({ textoOriginal, cantidad, sugerido, candidatos });
    }

    for (const ne of Array.isArray(reply.noEncontrados) ? reply.noEncontrados : []) {
        const textoOriginal = String(ne.textoOriginal || '').trim();
        const key = clave(textoOriginal);
        // Si el modelo mandó la misma línea en "items" y en "noEncontrados", gana el match:
        // cada línea va a un solo lado, nunca a los dos.
        if (vistos.has(key)) continue;
        vistos.add(key);
        resueltos.push({
            textoOriginal,
            motivo: typeof ne.motivo === 'string' && ne.motivo ? ne.motivo : 'no está en el catálogo'
        });
    }

    // Cobertura: lo que se mandó y el modelo no devolvió de ninguna forma.
    if (lineas) {
        for (const linea of lineas) {
            if (!vistos.has(clave(linea))) {
                resueltos.push({ textoOriginal: linea, motivo: 'no se pudo interpretar' });
            }
        }
    }

    // En foto y PDF no había líneas contables antes del llamado: el recorte va acá.
    let lineasIgnoradas = ignoradas;
    let dentro = resueltos;
    if (lineas === null && resueltos.length > limite) {
        lineasIgnoradas = resueltos.length - limite;
        dentro = resueltos.slice(0, limite);
    }

    const grupos = [];
    const porRubro = new Map();
    const noEncontrados = [];
    const ambiguas = [];

    for (const r of dentro) {
        if (r.candidatos) {
            ambiguas.push({
                textoOriginal: r.textoOriginal,
                cantidad: r.cantidad,
                sugerido: r.sugerido,
                candidatos: r.candidatos
            });
            continue;
        }
        if (!r.idproducto) {
            noEncontrados.push({ textoOriginal: r.textoOriginal, motivo: r.motivo });
            continue;
        }
        let grupo = porRubro.get(r.idrubro);
        if (!grupo) {
            grupo = { idrubro: r.idrubro, rubro: r.rubro, items: [] };
            porRubro.set(r.idrubro, grupo);
            grupos.push(grupo);
        }
        // Dos líneas de la entrada pueden matchear el mismo producto ("2 resmas A4" y
        // "5 resmas A4 75g"): se fusionan en un solo ítem para no duplicar la key en el
        // grupo ni la cantidad, sumando las cantidades y conservando ambos textos originales.
        const existente = grupo.items.find(it => it.idproducto === r.idproducto);
        if (existente) {
            existente.cantidad += r.cantidad;
            existente.textoOriginal += '; ' + r.textoOriginal;
        } else {
            grupo.items.push({
                textoOriginal: r.textoOriginal,
                idproducto: r.idproducto,
                nombreProducto: r.nombreProducto,
                cantidad: r.cantidad
            });
        }
    }

    return { res: true, grupos, ambiguas, noEncontrados, lineasIgnoradas };
}

module.exports = { procesarLista };
