module.exports = { createViews };

async function createViews(sequelize) {
    await sequelize.query('DROP VIEW IF EXISTS v_Busquedas');
    await sequelize.query(`
        CREATE VIEW v_Busquedas AS
        SELECT p.id, p.nombreproducto AS nombre, p.descripcion, p.imagen, p.refreshImagen
        FROM productos p`);

    await sequelize.query('DROP VIEW IF EXISTS v_Quodoms');
    await sequelize.query(`
        CREATE VIEW v_Quodoms AS
        SELECT q.id, q.descripcion, q.createdBy, q.estado, q.nro, q.iddireccion,
               q.fechaenvio, q.fechavencimientoenvio, q.fechavencimientoaceptacion,
               q.createdAt, q.updatedAt,
               (SELECT COUNT(*) FROM quodom_lines ql WHERE ql.idquodom = q.id) AS cantproductos,
               COALESCE((SELECT ROUND(100.0 * SUM(
                   CASE WHEN (ql.nombreAtributo1 IS NULL OR ql.atributo1 IS NOT NULL)
                         AND (ql.nombreAtributo2 IS NULL OR ql.atributo2 IS NOT NULL)
                        THEN 1 ELSE 0 END) / COUNT(*))
                 FROM quodom_lines ql WHERE ql.idquodom = q.id), 0) AS porccompletado,
               CAST(julianday(q.fechavencimientoenvio) - julianday('now') AS INTEGER) AS diasparavencimientoenvio,
               CAST(julianday(q.fechavencimientoaceptacion) - julianday('now') AS INTEGER) AS diasparavencimientoaceptacion
        FROM quodom_headers q
        WHERE COALESCE(q.ocultar, 0) = 0`);

    await sequelize.query('DROP VIEW IF EXISTS v_Quodoms_Lines');
    await sequelize.query(`
        CREATE VIEW v_Quodoms_Lines AS
        SELECT ql.id, ql.idquodom, ql.idproducto, ql.cantidad, ql.categoria,
               ql.nombreCategoria, ql.nombreProducto, ql.detalleProducto, ql.marca, ql.unidad,
               ql.atributo1, ql.atributo2, ql.nombreAtributo1, ql.nombreAtributo2,
               p.imagen, p.refreshImagen,
               (CASE WHEN ql.nombreAtributo1 IS NOT NULL AND ql.atributo1 IS NULL THEN 1 ELSE 0 END +
                CASE WHEN ql.nombreAtributo2 IS NOT NULL AND ql.atributo2 IS NULL THEN 1 ELSE 0 END) AS atributosFaltantes
        FROM quodom_lines ql
        LEFT JOIN productos p ON p.id = ql.idproducto`);

    await sequelize.query('DROP VIEW IF EXISTS v_InfoCompradors');
    await sequelize.query(`
        CREATE VIEW v_InfoCompradors AS
        SELECT q.id AS idquodom,
               COALESCE(u.nombre, '') || ' ' || COALESCE(u.apellido, '') AS NombreComprador,
               COALESCE(u.codArea, '') || COALESCE(u.telefono, '') AS telefono,
               u.email,
               COALESCE(d.calle, '') || ' ' || COALESCE(d.numero, '') AS Direccion,
               d.provincia AS Provincia,
               d.localidad AS Localidad,
               d.cp,
               d.observaciones
        FROM quodom_headers q
        INNER JOIN users u ON u.id = q.createdBy
        LEFT JOIN users_direcciones d ON d.id = q.iddireccion`);
}
