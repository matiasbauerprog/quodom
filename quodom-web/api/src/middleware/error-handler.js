module.exports = errorHandler;

function errorHandler(err, req, res, next) {

    console.log('ERROR LOG: ' + err);

    switch (true) {
        // express-openapi-validator: { status, errors: [{ path, message }] }
        case err !== null && typeof err === 'object' && Array.isArray(err.errors) && Number.isInteger(err.status): {
            if (err.status === 404 || err.status === 405) {
                return res.status(404).json({ res: false, message: 'Route-not-found' });
            }
            const campos = [...new Set(err.errors.map(campoDe).filter(Boolean))];
            return res.status(err.status).json({
                res: false,
                message: 'Faltan datos o hay datos inválidos' + (campos.length ? ': ' + campos.join(', ') : '.')
            });
        }
        case typeof err === 'string':
            //SL Errors comunes not found
            const is404 = err.toLowerCase().endsWith('not found');
            const statusCode = is404 ? 404 : 400;
            return res.status(statusCode).json({ res: false, message: err });

        case err.name === 'UnauthorizedError':
            //SL errores de JWT, los oculto en la respuesta, pero los muestro en consola.
            switch (err.message) {
                case 'jwt expired':
                    return res.status(401).json({ res: false, message: 'Token expirado.', exp:true });
                case 'invalid token':
                    return res.status(401).json({ res: false, message: 'Token invalido.' });
                default:
                    return res.status(401).json({ res: false, message: 'No autorizado.' });
            }

        case err !== null && typeof err === 'object' && Number.isInteger(err.status): {
            const { status, ...body } = err;
            return res.status(status).json({ res: false, ...body });
        }

        default:
            //SL Oculto los error en la respuesta, pero los muestro en consola
            return res.status(500).json({ res: false, message: 'Error en el servidor.' });
    }
}

// '/body/telefono' -> 'telefono'; a missing required field may come as
// path '/body' with "must have required property 'telefono'".
function campoDe(e) {
    const m = /required property '([^']+)'/.exec(e.message || '');
    if (m) return m[1];
    const partes = String(e.path || '').split('/').filter(Boolean);
    return partes.length > 1 ? partes[partes.length - 1] : null;
}
