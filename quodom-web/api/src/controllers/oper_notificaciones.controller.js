const db = require('../helpers/db');

module.exports = {
  getAll,
  getCount,
  update
};

async function getAll(userId) {
  return await db.oper_notificaciones.findAll({
    where: { userId: userId },
    order: [['createdAt', 'DESC']],
    attributes: ['id', 'titulo', 'texto', 'tiponotificacion', 'idquodom', 'createdAt', 'leida']
  });
}

async function getCount(userId) {
  return await db.oper_notificaciones.count({
    where: { userId: userId, leida: 0 }
  });
}

async function update(id, params, userId) {
  const notif = await db.oper_notificaciones.findByPk(id);
  if (!notif) throw 'Err. Notificacion no encontrada.';
  if (notif.userId !== userId) throw 'La notificación no pertenece a el usuario.';
  Object.assign(notif, params);
  await notif.save();
  return true;
}
