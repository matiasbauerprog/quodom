require('dotenv').config();
const path = require('path');
const XLSX = require('xlsx');
const db = require('../helpers/db');

const EXCEL_PATH = path.resolve(__dirname, '../../../../Documentacion 2.0/Categorias/Migracion.xlsx');

const PROVINCIAS = ['Buenos Aires', 'Ciudad Autónoma de Buenos Aires', 'Catamarca', 'Chaco',
    'Chubut', 'Córdoba', 'Corrientes', 'Entre Ríos', 'Formosa', 'Jujuy', 'La Pampa',
    'La Rioja', 'Mendoza', 'Misiones', 'Neuquén', 'Río Negro', 'Salta', 'San Juan',
    'San Luis', 'Santa Cruz', 'Santa Fe', 'Santiago del Estero', 'Tierra del Fuego', 'Tucumán'];

async function main() {
    await db.ready;
    console.log('Reading', EXCEL_PATH);
    const wb = XLSX.readFile(EXCEL_PATH);

    // 1. Categories
    const catRows = XLSX.utils.sheet_to_json(wb.Sheets['TodasCategorias']);
    let cats = 0;
    for (const row of catRows) {
        if (row.id === undefined || row.id === null || !row.NombreCategoria) continue;
        await db.Category.upsert({
            id: Math.round(Number(row.id)),
            nombrecategoria: String(row.NombreCategoria).trim(),
            idcategoriapadre: row.idcategoriapadre != null ? Math.round(Number(row.idcategoriapadre)) : 0,
            activa: row.activa != null ? Boolean(Number(row.activa)) : true,
            imagen: row.imagen ? String(row.imagen).trim() : null,
            refreshImage: row.refreshImagen ? String(row.refreshImagen).trim() : null,
            orden: row.orden != null ? Math.round(Number(row.orden)) : 0
        });
        cats++;
    }

    // 2. Products
    const prodRows = XLSX.utils.sheet_to_json(wb.Sheets['Productos']);
    let prods = 0;
    for (const row of prodRows) {
        if (row.id === undefined || row.id === null || !row.nombreproducto) continue;
        let categoria = row.categoria != null ? Math.round(Number(row.categoria)) : null;
        const categoriaPadre = row.categoriaPadre != null ? Math.round(Number(row.categoriaPadre)) : null;
        if (categoria === null) categoria = categoriaPadre;
        if (categoria === null) {
            console.warn('Skipping product without category:', row.id, row.nombreproducto);
            continue;
        }
        await db.Products.upsert({
            id: Math.round(Number(row.id)),
            nombreproducto: String(row.nombreproducto).trim(),
            descripcion: row.descripcion ? String(row.descripcion).trim() : null,
            categoria: categoria,
            categoriaPadre: categoriaPadre !== null ? categoriaPadre : categoria,
            idatributo: row.idatributo != null ? Math.round(Number(row.idatributo)) : null,
            nombreatributo: row.nombreatributo ? String(row.nombreatributo).trim() : null,
            unidadmedida: row.unidadmedida != null ? Math.round(Number(row.unidadmedida)) : null,
            nombreunidadmedida: row.nombreunidadmedida ? String(row.nombreunidadmedida).trim() : null,
            imagen: row.imagen ? String(row.imagen).trim() : null,
            refreshImagen: row.refreshImagen ? String(row.refreshImagen).trim() : null,
            atributo1: row.atributo1 ? String(row.atributo1).trim() : null,
            atributo2: row.atributo2 ? String(row.atributo2).trim() : null
        });
        prods++;
    }

    // 3. Product attributes
    const attrRows = XLSX.utils.sheet_to_json(wb.Sheets['Atributos']);
    await db.productos_atributos.destroy({ where: {}, truncate: true });
    let attrs = 0;
    for (const row of attrRows) {
        if (row.idproducto === undefined || row.idproducto === null) continue;
        await db.productos_atributos.create({
            idproducto: Math.round(Number(row.idproducto)),
            idatributo: row.idatributo != null ? Math.round(Number(row.idatributo)) : null,
            nombreatributo: row.nombreatributo ? String(row.nombreatributo).trim() : null,
            valoratributo: row.valoratributo != null ? String(row.valoratributo).trim() : null,
            orden: row.orden != null ? Math.round(Number(row.orden)) : 0,
            esvendedor: row.esvendedor != null ? String(row.esvendedor) : '0'
        });
        attrs++;
    }

    // 4. Provincias
    for (let i = 0; i < PROVINCIAS.length; i++) {
        await db.provincia.upsert({ id: i + 1, provincia: PROVINCIAS[i] });
    }

    // 5. Serie QUODOM
    const serie = await db.series.findOne({ where: { codigo: 'QUODOM' } });
    if (!serie) {
        await db.series.create({ codigo: 'QUODOM', utilizado: 0, sigla: 'QD-' });
    }

    // 6. Verification
    const subcats = await db.Category.count({ where: { idcategoriapadre: { [db.Sequelize.Op.ne]: 0 } } });
    const totalProds = await db.Products.count();
    console.log(`Seeded: ${cats} categories (${subcats} subcategories), ${totalProds} products, ${attrs} attribute rows, ${PROVINCIAS.length} provinces.`);
    if (subcats !== 50) throw new Error(`Expected 50 subcategories, got ${subcats}`);
    if (totalProds !== 644) throw new Error(`Expected 644 products, got ${totalProds}`);
    console.log('Seed verification OK (50 subcategories, 644 products).');
}

main()
    .then(() => process.exit(0))
    .catch(err => { console.error('Seed failed:', err); process.exit(1); });
