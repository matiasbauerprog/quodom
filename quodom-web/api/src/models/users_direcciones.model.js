const { DataTypes } = require('sequelize');

module.exports = model;

function model(sequelize) {
    const attributes = {
        userid: { type: DataTypes.STRING, allowNull: false },
        provincia: { type: DataTypes.INTEGER, allowNull: true },
        partido: { type: DataTypes.STRING, allowNull: true },
        localidad: { type: DataTypes.STRING, allowNull: true },
        direccion: { type: DataTypes.STRING, allowNull: true },
        calle: { type: DataTypes.STRING, allowNull: true },
        numero: { type: DataTypes.STRING, allowNull: true },
        piso: { type: DataTypes.STRING, allowNull: true },
        cp: { type: DataTypes.STRING, allowNull: true },
        alias: { type: DataTypes.STRING, allowNull: true },
        default: { type: DataTypes.TINYINT, allowNull: true },
        idprovincia: { type: DataTypes.STRING, allowNull: true },
        idpartido: { type: DataTypes.STRING, allowNull: true },
        observaciones: { type: DataTypes.STRING, allowNull: true },
        // Datos del mapa. `placeid` es el identificador de Google y es el único
        // dato de Places que se puede guardar sin límite de tiempo; las
        // coordenadas son caché de 30 días y se vuelven a resolver desde él.
        // Todo nullable: una dirección cargada a mano sigue siendo válida.
        placeid: { type: DataTypes.STRING, allowNull: true },
        lat: { type: DataTypes.FLOAT, allowNull: true },
        lng: { type: DataTypes.FLOAT, allowNull: true },
        coords_actualizado: { type: DataTypes.DATE, allowNull: true },
        // El usuario puso el pin en el mapa con la mano. Distingue el tercer
        // caso de precisión: antes `preciso` salía sólo del `placeid`, y un
        // punto elegido a mano no tiene placeid pero es exacto — sin esta
        // columna, marcar tu casa en el mapa seguía mostrando "tu dirección no
        // está ubicada con precisión".
        //
        // Es **dato nuestro y no de Google**, así que no cae en la caché de 30
        // días: ver `puntoDelQuodom`.
        punto_manual: { type: DataTypes.BOOLEAN, allowNull: true },
    };

    const options = {
        defaultScope: {
        },
        scopes: {
        }
    };

    return sequelize.define('users_direcciones', attributes, options);
}
