const XLSX = require('xlsx');

const EXT_PLANILLA = ['.xlsx', '.xls', '.csv'];
const MIME_POR_EXT = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.pdf': 'application/pdf'
};

// El texto que acompaña a una foto o PDF: el modelo necesita saber qué mira.
const PROMPT_ARCHIVO = 'Esta imagen o documento contiene una lista de compras. ' +
    'Leé cada renglón tal como está escrito.';

class EntradaInvalida extends Error {
    constructor(codigo, message) {
        super(message);
        this.name = 'EntradaInvalida';
        this.codigo = codigo;
    }
}

function MAX_FILE_MB() {
    const v = parseInt(process.env.IA_LISTA_MAX_FILE_MB || '5', 10);
    return Number.isFinite(v) && v > 0 ? v : 5;
}

function extension(nombre) {
    const i = String(nombre || '').lastIndexOf('.');
    return i === -1 ? '' : String(nombre).slice(i).toLowerCase();
}

function aLineas(texto) {
    return String(texto || '')
        .split(/\r?\n/)
        .map(l => l.trim())
        .filter(Boolean);
}

function planillaALineas(buffer) {
    let filas;
    try {
        const wb = XLSX.read(buffer, { type: 'buffer' });
        const hoja = wb.Sheets[wb.SheetNames[0]];
        if (!hoja) throw new Error('sin hojas');
        filas = XLSX.utils.sheet_to_json(hoja, { header: 1, blankrows: false });
    } catch (e) {
        throw new EntradaInvalida('archivo_ilegible',
            'No pude abrir el archivo. Probá exportarlo de nuevo o pegá la lista como texto.');
    }
    return filas
        .map(fila => (Array.isArray(fila) ? fila : [])
            .map(c => (c === null || c === undefined ? '' : String(c).trim()))
            .filter(Boolean)
            .join(' ')
            .trim())
        .filter(Boolean);
}

function recortar(lineas, maxLineas) {
    if (lineas.length <= maxLineas) return { lineas, ignoradas: 0 };
    return { lineas: lineas.slice(0, maxLineas), ignoradas: lineas.length - maxLineas };
}

// Devuelve { parts, lineas, ignoradas }. `lineas` es null cuando el formato no
// permite contarlas antes del llamado (foto y PDF): ahí el recorte lo hace el
// controller, sobre el resultado.
function normalizar(entrada, maxLineas) {
    const e = entrada || {};

    if (e.tipo === 'archivo') {
        const archivo = e.archivo || {};
        const ext = extension(archivo.nombre);
        const datos = String(archivo.datosBase64 || '');
        if (!datos) {
            throw new EntradaInvalida('lista_vacia', 'No mandaste ningún archivo.');
        }

        const buffer = Buffer.from(datos, 'base64');
        if (buffer.length > MAX_FILE_MB() * 1024 * 1024) {
            throw new EntradaInvalida('archivo_muy_grande',
                'El archivo supera los ' + MAX_FILE_MB() + ' MB.');
        }

        if (EXT_PLANILLA.includes(ext)) {
            const todas = planillaALineas(buffer);
            if (todas.length === 0) {
                throw new EntradaInvalida('lista_vacia', 'La planilla no tiene ninguna fila con datos.');
            }
            const { lineas, ignoradas } = recortar(todas, maxLineas);
            return { parts: [{ text: lineas.join('\n') }], lineas, ignoradas };
        }

        const mimeType = MIME_POR_EXT[ext];
        if (!mimeType) {
            throw new EntradaInvalida('formato_no_soportado',
                'Ese formato no se puede leer. Subí un Excel, un CSV, una foto, un PDF, o pegá la lista como texto.');
        }
        return {
            parts: [{ inlineData: { mimeType, data: datos } }, { text: PROMPT_ARCHIVO }],
            lineas: null,
            ignoradas: 0
        };
    }

    const todas = aLineas(e.texto);
    if (todas.length === 0) {
        throw new EntradaInvalida('lista_vacia', 'Escribí o pegá la lista para poder buscarla.');
    }
    const { lineas, ignoradas } = recortar(todas, maxLineas);
    return { parts: [{ text: lineas.join('\n') }], lineas, ignoradas };
}

module.exports = { normalizar, EntradaInvalida };
