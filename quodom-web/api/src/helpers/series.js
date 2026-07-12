const db = require('../helpers/db');

module.exports = {
    incrementar
};

async function incrementar(codigo) {
    const serie = await db.series.findOne({
        where: { codigo: codigo }
    });

    if (serie) {
        let utilizado = (serie.utilizado + 1);
        Object.assign(serie, { utilizado: utilizado });
        await serie.save();
        return (serie.sigla + utilizado);
    } else {
        throw 'error';
    }
}
