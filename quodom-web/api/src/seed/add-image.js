const path = require('path');
const fs = require('fs');

const UPLOADS_DIR = path.resolve(__dirname, '../../uploads/producto');
const ALLOWED = new Set(['.png', '.jpg', '.jpeg', '.webp']);

function usage(msg) {
    if (msg) console.error('Error: ' + msg);
    console.error('Uso: npm run add-image -- <idproducto> <ruta_imagen>');
    console.error('Ej:  npm run add-image -- 87 "C:\\Users\\yo\\Desktop\\piedra binder.jpg"');
    process.exit(1);
}

function main() {
    const [, , idArg, srcArg] = process.argv;
    if (!idArg || !srcArg) usage('Faltan argumentos.');
    const id = parseInt(idArg, 10);
    if (!Number.isInteger(id) || id <= 0) usage('idproducto inválido: ' + idArg);
    const src = path.resolve(srcArg);
    if (!fs.existsSync(src)) usage('Archivo no encontrado: ' + src);
    const ext = path.extname(src).toLowerCase();
    if (!ALLOWED.has(ext)) usage('Extensión no soportada (usar png/jpg/jpeg/webp): ' + ext);

    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    for (const e of ALLOWED) {
        const old = path.join(UPLOADS_DIR, id + e);
        if (fs.existsSync(old)) fs.unlinkSync(old);
    }
    const dest = path.join(UPLOADS_DIR, id + ext);
    fs.copyFileSync(src, dest);
    console.log('OK: ' + dest);
}

main();
