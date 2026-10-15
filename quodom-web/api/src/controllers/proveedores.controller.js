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

    // Lo que ya pasó con este Quodom. Se lee **después** de la búsqueda y antes
    // de anotar, para que un fallo de Google no escriba nada (el test lo fija).
    const filas = await db.quodom_proveedores.findAll({ where: { idquodom } });
    const contactados = filas.filter(f => f.contactado_en);

    // Lo que el feature aprendió de los usuarios anteriores. Incluye a los
    // contactados que hoy no vinieron, que igual se muestran.
    const reportados = await db.lugares_sinwhatsapp.findAll({
        where: { placeid: ubicables.map(c => c.placeid).concat(contactados.map(f => f.placeid)) }
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
    await anotarOfrecidos(idquodom, elegidos, filas);

    const porPlace = new Map(filas.map(f => [f.placeid, f.contactado_en]));
    const vinieronHoy = new Set(elegidos.map(p => p.placeid));

    // Un contactado que la búsqueda de hoy no devolvió NO se cae de la
    // respuesta. `searchText` ordena por relevancia y el sesgo de ubicación es
    // sólo una preferencia, así que el que se contactó el lunes puede no entrar
    // en los cinco del miércoles. En el selector da igual; en el historial, que
    // existe para contestar "a quién le mandé", desaparecía: el comprador le
    // escribía de nuevo, o concluía que nunca le había escrito.
    //
    // De Google sólo se archiva el place_id, así que de este renglón se sabe
    // eso y la fecha: va sin nombre, sin distancia (no hay desde dónde medirlo,
    // y un número ahí sería medido desde otra parte) y sin teléfono, con el
    // link a Maps, que el place_id sí alcanza para armar.
    const olvidados = contactados
        .filter(f => !vinieronHoy.has(f.placeid))
        .map(f => ({
            placeid: f.placeid,
            nombre: '',
            rating: null,
            resenas: 0,
            distanciakm: null,
            telefono: null,
            telefonovisible: null,
            sintelefono: false,
            esfijo: false,
            sinwhatsapp: sinWhatsapp.has(f.placeid),
            direccion: '',
            contactadoen: f.contactado_en,
            sindatos: true
        }));

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
            contactadoen: porPlace.get(p.placeid) || null,
            sindatos: false
        })).concat(olvidados),
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

    // El estado se lee ANTES de limpiarlo: lo que habilita el reporte es que el
    // lugar se le haya ofrecido al comprador (`orden`, que pone
    // `anotarOfrecidos`) y que el comprador le haya mandado (`contactado_en`).
    // Es la única situación que significa lo que dice la pantalla: "toqué el
    // botón recién y WhatsApp no abrió".
    //
    // Sin esta guarda, `lugares_sinwhatsapp` —global, permanente, compartido
    // por todos los compradores y sin forma de deshacerse— lo escribe cualquier
    // sesión: se crea un Quodom y se manda este POST en bucle con placeids
    // sacados de Maps. El endpoint no consulta a Google, así que a propósito no
    // tiene cupo que lo frene. Y pasa también sin mala intención:
    // `whatsappLink` crea la fila para cualquier `proveedor=` con un celular
    // válido, y entonces `if (fila)` ya tenía algo que encontrar.
    const eraContactado = !!(fila && fila.contactado_en && fila.orden != null);

    if (fila) {
        fila.contactado_en = null;
        await fila.save();
    }

    // El único dato propio que acumula el feature. Es una observación nuestra
    // indexada por place_id, así que se puede guardar sin límite de tiempo. El
    // segundo reporte del mismo lugar tiene que sumar y no fallar: es
    // exactamente el caso que hace que la lista de una zona mejore con el uso.
    if (motivo === 'sin_whatsapp' && eraContactado) {
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
async function anotarOfrecidos(idquodom, elegidos, existentes) {
    const conocidos = new Set(existentes.map(f => f.placeid));

    for (let i = 0; i < elegidos.length; i++) {
        if (conocidos.has(elegidos[i].placeid)) continue;
        await db.quodom_proveedores.create({
            idquodom, placeid: elegidos[i].placeid, orden: i + 1
        });
    }
}
