const db = require('./db');
const { RUBROS_ACTIVOS } = require('../config/rubros');

// El rubro de una categoría: si es una subcategoría, su padre; si la categoría
// ES un rubro (idcategoriapadre = 0), ella misma. `productos.categoriaPadre` no
// se usa: contradice a `categorias` en 24 productos y en cinco de ellos apunta a
// un rubro activo cuando la categoría real es de uno desactivado.
function rubroDeCategoria(categoria) {
    return categoria.idcategoriapadre === 0 ? categoria.id : categoria.idcategoriapadre;
}

// Los productos de rubros activos, con su rubro ya resuelto. Es la única fuente
// de rubro: lo que se usa para filtrar es lo mismo que se usa para agrupar.
async function catalogoActivo() {
    const categorias = await db.Category.findAll({
        where: { activa: true },
        attributes: ['id', 'nombrecategoria', 'idcategoriapadre']
    });
    const porId = new Map(categorias.map(c => [c.id, c]));
    const nombrePorRubro = new Map(
        categorias.filter(c => c.idcategoriapadre === 0).map(c => [c.id, c.nombrecategoria])
    );

    const productos = await db.Products.findAll({
        attributes: ['id', 'nombreproducto', 'categoria']
    });

    const catalogo = [];
    for (const p of productos) {
        const categoria = porId.get(p.categoria);
        if (!categoria) continue;
        const idrubro = rubroDeCategoria(categoria);
        if (!RUBROS_ACTIVOS.includes(idrubro)) continue;
        catalogo.push({
            id: p.id,
            nombre: p.nombreproducto,
            idrubro,
            rubro: nombrePorRubro.get(idrubro) || ''
        });
    }
    return catalogo;
}

module.exports = { catalogoActivo, rubroDeCategoria };
