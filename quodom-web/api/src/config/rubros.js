// Rubros habilitados en la webapp.
//
// El catálogo migrado desde el Excel tiene los ocho rubros originales, pero el
// lanzamiento arranca con cinco. Los otros tres quedan en la base intacta (con
// sus subcategorías y productos) y se reactivan agregando su id a la lista.
//
// La lista vive acá y no en la columna `activa` de `categorias` a propósito:
// `quodom.sqlite` se commitea y corre en modo WAL (ver CLAUDE.md §6), así que
// un cambio de datos no se revisa en el diff ni sobrevive con seguridad a un
// reseed. Un cambio de código sí.
const RUBROS_ACTIVOS = [
    1, // Limpieza
    2, // Librería
    3, // Papelera
    5, // Pintura
    7  // Bebidas
    // 4, // Construcción         — pendiente para una etapa posterior
    // 6, // Sanitarios           — pendiente para una etapa posterior
    // 8, // Seguridad Industrial — pendiente para una etapa posterior
];

// Los ids llegan como string desde los params de Express y como number desde
// Sequelize, así que se normaliza antes de comparar.
function esRubroActivo(idrubro) {
    return RUBROS_ACTIVOS.includes(Number(idrubro));
}

module.exports = { RUBROS_ACTIVOS, esRubroActivo };
