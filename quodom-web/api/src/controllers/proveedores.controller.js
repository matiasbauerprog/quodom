const db = require('../helpers/db');
const places = require('../helpers/places');
const { rankear } = require('../helpers/rankearProveedores');
const { terminoDeRubro } = require('../config/rubrosPlaces');
const { analizarTelefono } = require('../helpers/telefonoWhatsapp');
const { puntoDelQuodom } = require('../helpers/puntoDelQuodom');
const { httpError } = require('../helpers/http-error');

const ATRIBUCION = 'Resultados de Google';

module.exports = { listar, noEnviado };

async function listar(idquodom, userId) {
    const quodom = await db.Quodom.findByPk(idquodom);
    if (!quodom) throw 'El Quodom no existe.';
    if (quodom.createdBy !== userId) throw 'El Id Quodom no pertenece a el usuario.';

    const termino = terminoDeRubro(quodom.idrubro);
    if (!termino) {
        // Un rubro activo sin término es un olvido de configuración, no un caso
        // del usuario: se avisa en el log y se devuelve vacío en vez de romper.
        console.warn('proveedores: rubro sin término de búsqueda. idrubro=' + quodom.idrubro);
        return { proveedores: [], preciso: false, desde: '', atribucion: ATRIBUCION };
    }

    // El Quodom va como argumento porque la dirección la resuelve el mismo
    // helper que usa el WhatsApp del proveedor: así el punto desde el que se
    // mide y el domicilio del mensaje salen de la misma fila.
    const punto = await puntoDelQuodom(quodom, userId);
    if (!punto) {
        throw httpError(409, 'sin_ubicacion',
            'No pudimos ubicar tu dirección, ni siquiera por su localidad.');
    }

    const crudos = await places.buscarProveedores({ texto: termino, lat: punto.lat, lng: punto.lng });

    // Un lugar sin ubicación llega con lat/lng en null y no se puede medir: su
    // distancia saldría NaN, que ordena de forma impredecible y el renglón
    // diría "a NaN km". Es mejor no ofrecerlo que ofrecerlo sin distancia.
    const ubicables = crudos.filter(c => c.lat != null && c.lng != null);

    // Lo que el feature aprendió de los usuarios anteriores.
    const reportados = await db.lugares_sinwhatsapp.findAll({
        where: { placeid: ubicables.map(c => c.placeid) }
    });
    const sinWhatsapp = new Set(reportados.map(r => r.placeid));

    const conTelefono = ubicables.map(c => {
        const tel = analizarTelefono(c.telefono);
        return {
            ...c,
            // Un número que no puede recibir WhatsApp (un 0800) viaja como
            // teléfono para "llamar", pero sin número de WhatsApp: el renglón
            // muestra el botón de llamar y no el de WhatsApp.
            telefono: tel && tel.sirveWhatsapp ? tel.e164 : null,
            telefonoVisible: tel ? tel.original : null,
            esFijo: tel ? tel.esFijo : false,
            sinWhatsapp: sinWhatsapp.has(c.placeid)
        };
    });

    const elegidos = rankear(conTelefono, punto);
    await anotarOfrecidos(idquodom, elegidos);

    const yaContactados = await db.quodom_proveedores.findAll({ where: { idquodom } });
    const porPlace = new Map(yaContactados.map(f => [f.placeid, f.contactado_en]));

    return {
        proveedores: elegidos.map(p => ({
            placeid: p.placeid,
            nombre: p.nombre,
            rating: p.rating,
            resenas: p.resenas,
            distanciakm: Math.round(p.distanciaKm * 10) / 10,
            telefono: p.telefono,
            telefonovisible: p.telefonoVisible || null,
            sintelefono: p.sinTelefono,
            esfijo: p.esFijo,
            sinwhatsapp: p.sinWhatsapp,
            direccion: p.direccion,
            contactadoen: porPlace.get(p.placeid) || null
        })),
        preciso: punto.preciso,
        desde: punto.desde,
        atribucion: ATRIBUCION
    };
}

// Deshacer el contacto: el comprador tocó el botón y del otro lado no había
// nadie. Se borra la marca para que el proveedor vuelva a ofrecerse, y el Quodom
// se deja como está: ya salió, y volverlo a CREADO borraría la notificación y el
// historial de algo que sí pasó.
async function noEnviado(idquodom, userId, { placeid, motivo }) {
    const quodom = await db.Quodom.findByPk(idquodom);
    if (!quodom || quodom.createdBy !== userId) {
        throw 'El Id Quodom no pertenece a el usuario.';
    }

    const fila = await db.quodom_proveedores.findOne({ where: { idquodom, placeid } });
    if (fila) {
        fila.contactado_en = null;
        await fila.save();
    }

    // El único dato propio que acumula el feature. Es una observación nuestra
    // indexada por place_id, así que se puede guardar sin límite de tiempo. El
    // segundo reporte del mismo lugar tiene que sumar y no fallar: es
    // exactamente el caso que hace que la lista de una zona mejore con el uso.
    if (motivo === 'sin_whatsapp') {
        const [lugar, creado] = await db.lugares_sinwhatsapp.findOrCreate({
            where: { placeid }, defaults: { placeid, reportes: 1 }
        });
        if (!creado) {
            lugar.reportes = (lugar.reportes || 0) + 1;
            await lugar.save();
        }
    }

    return { res: true };
}

// Se anota a quiénes se le ofreció, sin pisar lo ya contactado: el usuario puede
// volver a abrir el popup y la lista puede venir distinta. La tabla no tiene
// unique sobre (idquodom, placeid), así que la única defensa contra duplicar una
// fila en la segunda consulta —que es lo normal— es leer lo que ya está.
async function anotarOfrecidos(idquodom, elegidos) {
    const existentes = await db.quodom_proveedores.findAll({ where: { idquodom } });
    const conocidos = new Set(existentes.map(f => f.placeid));

    for (let i = 0; i < elegidos.length; i++) {
        if (conocidos.has(elegidos[i].placeid)) continue;
        await db.quodom_proveedores.create({
            idquodom, placeid: elegidos[i].placeid, orden: i + 1
        });
    }
}
