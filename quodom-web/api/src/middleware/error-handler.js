module.exports = errorHandler;

function errorHandler(err, req, res, next) {

    console.log('ERROR LOG: ' + err);

    switch (true) {
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

        case err !== null && typeof err === 'object' && Number.isInteger(err.status):
            const { status, ...body } = err;
            return res.status(status).json({ res: false, ...body });

        default:
            //SL Oculto los error en la respuesta, pero los muestro en consola
            return res.status(500).json({ res: false, message: 'Error en el servidor.' });
    }
}
