require('dotenv').config();
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');

const EXCEL_PATH = path.resolve(__dirname, '../../../../Documentacion 2.0/Categorias/Migracion.xlsx');
const UPLOADS_DIR = path.resolve(__dirname, '../../uploads/producto');
const OUT_CSV = path.resolve(__dirname, '../../uploads/faltantes.csv');
const OUT_TXT = path.resolve(__dirname, '../../uploads/faltantes.txt');

const EXTS = ['.png', '.jpg', '.jpeg', '.webp'];

function hasImage(id) {
    for (const ext of EXTS) if (fs.existsSync(path.join(UPLOADS_DIR, id + ext))) return true;
    return false;
}

function csvCell(s) {
    const v = String(s ?? '');
    return /[,"\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
}

function main() {
    const wb = XLSX.readFile(EXCEL_PATH);
    const cats = new Map();
    for (const r of XLSX.utils.sheet_to_json(wb.Sheets['TodasCategorias'])) {
        if (r.id != null) cats.set(Math.round(Number(r.id)), {
            nombre: String(r.NombreCategoria || '').trim(),
            padre: r.idcategoriapadre != null ? Math.round(Number(r.idcategoriapadre)) : 0
        });
    }
    const rubroName = (id) => {
        let c = cats.get(id);
        while (c && c.padre !== 0) c = cats.get(c.padre);
        return c ? c.nombre : '';
    };
    const subName = (id) => (cats.get(id)?.nombre) || '';

    const missing = [];
    for (const r of XLSX.utils.sheet_to_json(wb.Sheets['Productos'])) {
        if (r.id == null || !r.nombreproducto) continue;
        const id = Math.round(Number(r.id));
        if (hasImage(id)) continue;
        const subcat = r.categoria != null ? Math.round(Number(r.categoria)) : null;
        missing.push({
            id,
            nombre: String(r.nombreproducto).trim(),
            rubro: subcat != null ? rubroName(subcat) : '',
            subcat: subcat != null ? subName(subcat) : ''
        });
    }

    missing.sort((a, b) => (a.rubro + a.subcat).localeCompare(b.rubro + b.subcat) || a.id - b.id);

    const csvLines = ['id,rubro,subcategoria,nombreproducto,archivo_esperado'];
    for (const m of missing) {
        csvLines.push([m.id, csvCell(m.rubro), csvCell(m.subcat), csvCell(m.nombre), m.id + '.png'].join(','));
    }
    fs.writeFileSync(OUT_CSV, csvLines.join('\n'), 'utf-8');

    const txtLines = [];
    let currentGroup = '';
    for (const m of missing) {
        const group = m.rubro + ' / ' + m.subcat;
        if (group !== currentGroup) {
            txtLines.push('', '### ' + group);
            currentGroup = group;
        }
        txtLines.push('  #' + String(m.id).padStart(4) + '  ' + m.nombre);
    }
    fs.writeFileSync(OUT_TXT, txtLines.join('\n'), 'utf-8');

    console.log('Missing products: ' + missing.length);
    console.log('CSV: ' + OUT_CSV);
    console.log('TXT (agrupado por rubro): ' + OUT_TXT);
}

main();
