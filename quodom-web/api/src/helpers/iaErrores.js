// Traduce un fallo de callGemini a la respuesta que ve el usuario. Vive acá
// porque lo comparten /api/ia/chat y /api/ia/lista.
function responderFalloIa(res, e, contexto) {
    console.error('ia: ' + contexto + ' failed:', e && e.stack ? e.stack : e);
    const msg = String((e && e.message) || '');

    if (msg.includes('HTTP 429')) {
        res.set('Retry-After', '60');
        return res.status(429).json({
            res: false,
            error: 'ia_quota',
            message: 'La cuota diaria de la IA se agotó. Esperá unos minutos e intentá de nuevo, o pedile al admin que active el plan pago.'
        });
    }

    if (/HTTP 5\d\d/.test(msg) || msg.includes('timeout')) {
        res.set('Retry-After', '30');
        return res.status(503).json({
            res: false,
            error: 'ia_busy',
            message: 'La IA está sobrecargada en este momento. Probá de nuevo en unos segundos.'
        });
    }

    return res.status(500).json({
        res: false,
        error: 'ia_unavailable',
        message: 'El asistente no está disponible por ahora. Probá de nuevo en un momento.'
    });
}

module.exports = { responderFalloIa };
