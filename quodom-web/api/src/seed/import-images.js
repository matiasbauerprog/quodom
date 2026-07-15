require('dotenv').config();
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');

const EXCEL_PATH = path.resolve(__dirname, '../../../../Documentacion 2.0/Categorias/Migracion.xlsx');
const DEFAULT_SRC = path.resolve(__dirname, '../../../../Documentacion 2.0/Categorias');
const DEST_DIR = path.resolve(__dirname, '../../uploads/producto');
const SRC_DIR = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_SRC;

const EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp']);

const UNIT_SYNONYMS = new Map([
    ['lts', 'litros'], ['lt', 'litros'], ['l', 'litros'],
    ['kg', 'kilos'], ['grs', 'gramos'], ['gr', 'gramos'], ['g', 'gramos'],
    ['und', 'unidades'], ['unid', 'unidades'], ['un', 'unidades'], ['u', 'unidades'],
    ['pares', 'par'], ['x', 'por'], ['pza', 'pieza'], ['pzas', 'piezas'],
    ['m3', 'metroscubicos'], ['m2', 'metroscuadrados']
]);
const STOP_WORDS = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'para', 'con', 'sin', 'y']);

function tokens(s) {
    const raw = String(s ?? '')
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()
        .split(/\s+/)
        .filter(Boolean);
    return raw
        .map(t => UNIT_SYNONYMS.get(t) ?? t)
        .filter(t => !STOP_WORDS.has(t));
}
const norm = (s) => tokens(s).join(' ');

function walk(dir) {
    const out = [];
    for (const name of fs.readdirSync(dir)) {
        const full = path.join(dir, name);
        const st = fs.statSync(full);
        if (st.isDirectory()) out.push(...walk(full));
        else if (EXTS.has(path.extname(name).toLowerCase())) out.push(full);
    }
    return out;
}

function jaccard(a, b) {
    if (a.length === 0 || b.length === 0) return 0;
    const setA = new Set(a), setB = new Set(b);
    let inter = 0;
    for (const t of setA) if (setB.has(t)) inter++;
    const union = setA.size + setB.size - inter;
    return inter / union;
}

function main() {
    if (!fs.existsSync(EXCEL_PATH)) throw new Error('Excel not found: ' + EXCEL_PATH);
    if (!fs.existsSync(SRC_DIR)) throw new Error('Source folder not found: ' + SRC_DIR);
    fs.mkdirSync(DEST_DIR, { recursive: true });

    const wb = XLSX.readFile(EXCEL_PATH);
    const prodRows = XLSX.utils.sheet_to_json(wb.Sheets['Productos']);
    const products = prodRows
        .filter(r => r.id != null && r.nombreproducto)
        .map(r => {
            const nombre = String(r.nombreproducto).trim();
            return { id: Math.round(Number(r.id)), nombre, key: norm(nombre), toks: tokens(nombre) };
        });

    const productsByKey = new Map();
    for (const p of products) {
        if (!productsByKey.has(p.key)) productsByKey.set(p.key, []);
        productsByKey.get(p.key).push(p);
    }

    const files = walk(SRC_DIR).map(f => {
        const base = path.basename(f, path.extname(f));
        return { file: f, ext: path.extname(f).toLowerCase(), base, key: norm(base), toks: tokens(base) };
    });

    console.log(`Products in Excel: ${products.length}`);
    console.log(`Image files found: ${files.length}`);
    console.log(`Copying to: ${DEST_DIR}`);

    const takenByProduct = new Map();
    const takenFiles = new Set();

    for (const f of files) {
        const hits = productsByKey.get(f.key);
        if (!hits) continue;
        for (const p of hits) if (!takenByProduct.has(p.id)) takenByProduct.set(p.id, f);
        takenFiles.add(f.file);
    }

    const stillMissing = products.filter(p => !takenByProduct.has(p.id));
    const orphanFiles = files.filter(f => !takenFiles.has(f.file));

    for (const p of stillMissing) {
        let best = null, bestScore = 0;
        for (const f of orphanFiles) {
            if (takenFiles.has(f.file)) continue;
            const score = jaccard(p.toks, f.toks);
            if (score > bestScore) { bestScore = score; best = f; }
        }
        if (best && bestScore >= 0.6) {
            takenByProduct.set(p.id, best);
            takenFiles.add(best.file);
        }
    }

    let copied = 0;
    for (const [id, f] of takenByProduct) {
        const dest = path.join(DEST_DIR, id + f.ext);
        fs.copyFileSync(f.file, dest);
        copied++;
    }

    const missing = products.filter(p => !takenByProduct.has(p.id));
    const finalOrphans = files.filter(f => !takenFiles.has(f.file));

    console.log(`\nMatched products: ${takenByProduct.size} / ${products.length}   (copied ${copied})`);
    console.log(`Orphan image files (no product): ${finalOrphans.length}`);

    if (missing.length > 0) {
        console.log('\n--- Products WITHOUT image (' + missing.length + ') ---');
        for (const p of missing) console.log('  #' + p.id + '  ' + p.nombre);
    }
    if (finalOrphans.length > 0) {
        console.log('\n--- Orphan files (' + finalOrphans.length + ') ---');
        for (const f of finalOrphans.slice(0, 60)) console.log('  ' + path.relative(SRC_DIR, f.file));
        if (finalOrphans.length > 60) console.log('  ...(+ ' + (finalOrphans.length - 60) + ' more)');
    }
}

main();
