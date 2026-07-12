const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../helpers/db');
const correo = require('../helpers/email');
const { Op } = require('sequelize');

module.exports = {
  authenticate,
  getAll,
  getById,
  getUserDirecciones,
  getUserDireccionDefault,
  getInfoComprador,
  create,
  update,
  updateFoto,
  reset,
  reenviar,
  validateEmail,
  changePass,
  delete: _delete
};

const emailEnabled = () => process.env.EMAIL_ENABLED === 'true';

async function authenticate({ username, password }) {
  const user = await db.User.scope('withHash').findOne({
    where: {
      [Op.or]: [{ email: username }, { username: username }]
    }
  });

  if (!user || !(await bcrypt.compare(password, user.password)))
    throw 'Usuario, e-mail o contraseña incorrectos.';

  if (!user.activo)
    throw 'El Usuario se encuentra actualmente bloqueado.';

  if (!user.emailValidado)
    throw 'Valida tu correo electronico primero.';

  const token = generarToken(user.id, '4800h');

  return { ...omitPassword(user.get()), token };
}

async function getAll() {
  return await db.User.findAll({
    attributes: { exclude: ['password', 'role'] }
  });
}

async function getById(id) {
  return await getUser(id);
}

async function create(params) {
  if (await db.User.findOne({ where: { email: params.email } })) {
    throw 'El correo electrónico ya está en uso.';
  }

  if (await db.User.findOne({ where: { username: params.username } })) {
    throw 'El usuario ya está en uso.';
  }

  if (params.password) {
    params.password = await bcrypt.hash(params.password, 10);
  }

  params.activo = true;
  params.emailValidado = !emailEnabled();
  params.role = 'user';

  const user = await db.User.create(params);

  const token = generarToken(user.id, '72h');
  const link = process.env.APP_URL + '/validar-email/' + token;
  const ret = await correo.sendEmail(user, link, 'Verifica tu correo electrónico', 'validar-email');

  if (!ret) {
    return { res: false, message: 'El usuario fue creado pero el correo no pudo ser enviado.' };
  }

  return { res: true, id: user.id, message: 'Usuario creado correctamente, revise su casilla de correo para activar su cuenta.' };
}

async function update(id, params) {
  const user = await getUser(id);

  const usernameChanged = params.username && user.username !== params.username;
  if (usernameChanged && await db.User.findOne({ where: { username: params.username } })) {
    throw 'Usuario ya está en uso.';
  }

  const emailChanged = params.email && user.email !== params.email;
  if (emailChanged && await db.User.findOne({ where: { email: params.email } })) {
    throw 'Correo electrónico ya está en uso.';
  }

  if (params.password) {
    params.password = await bcrypt.hash(params.password, 10);
  }

  Object.assign(user, params);
  await user.save();

  return omitPassword(user.get());
}

async function updateFoto(id, params) {
  const user = await getUser(id);
  const refreshFoto = Math.random();

  if (params.refreshFoto == 'borrar') {
    params.refreshFoto = null;
  } else {
    params.refreshFoto = refreshFoto.toString();
  }

  Object.assign(user, params);
  await user.save();

  return refreshFoto.toString();
}

async function reset(params) {
  const user = await db.User.findOne({
    where: {
      [Op.or]: [{ email: params.email }, { username: params.email }]
    }
  });

  if (!user) throw 'Revisá tu e-mail o usuario.';
  if (!user.activo) throw 'Usuario bloqueado.';
  if (!user.emailValidado) throw 'Valida tu e-mail primero.';

  const token = generarToken(user.id, '1h', 'resetpass');
  const link = process.env.APP_URL + '/reset-password/' + token;
  const ret = await correo.sendEmail(user, link, 'Restablecer contraseña QUODOM', 'reset-password');

  if (!ret) {
    return { res: false, message: 'El correo no pudo ser enviado.' };
  }

  return { res: true, message: 'Correo enviado correctamente, recuerda que el link tiene una duracion de 1 hora.' };
}

async function validateEmail(id) {
  const user = await getUser(id);

  if (user.emailValidado) throw 'El correo ya se encuentra validado.';

  return await user.update({ emailValidado: true });
}

async function reenviar(params) {
  const user = await db.User.findOne({ where: { email: params.email } });
  if (!user) throw 'Correo electronico no encontrado.';

  const token = generarToken(user.id, '72h');
  const link = process.env.APP_URL + '/validar-email/' + token;
  const ret = await correo.sendEmail(user, link, 'Verifica tu correo electrónico', 'validar-email');

  if (!ret) {
    return { res: false, message: 'El correo no pudo ser enviado.' };
  }
  return { res: true, message: 'Correo enviado correctamente.' };
}

async function _delete(id) {
  const user = await getUser(id);
  await user.destroy();
}

async function changePass(id, params) {
  const user = await getUser(id);

  if (!user.activo) throw 'El Usuario se encuentra actualmente bloqueado.';

  if (params.password) {
    params.password = await bcrypt.hash(params.password, 10);
  }
  return await user.update({ password: params.password });
}

async function getUserDirecciones(userId) {
  return await db.user_direcciones.findAll({
    where: { userid: userId },
    order: [['id', 'ASC']],
    attributes: { exclude: ['createdAt', 'updatedAt'] }
  });
}

async function getUserDireccionDefault(userId) {
  let dire = await db.user_direcciones.findOne({
    where: { userid: userId, default: true },
    attributes: { exclude: ['createdAt', 'updatedAt'] }
  });

  if (!dire) {
    dire = await db.user_direcciones.findOne({
      where: { userid: userId },
      order: [['id', 'ASC']],
      attributes: { exclude: ['createdAt', 'updatedAt'] }
    });
  }

  return dire;
}

async function getInfoComprador(idquodom) {
  return await db.v_InfoCompradors.findOne({
    where: { idquodom: idquodom }
  });
}

// helpers
async function getUser(id) {
  const user = await db.User.findByPk(id);
  if (!user) throw 'Err. Usuario no encontrado.';
  return user;
}

function omitPassword(user) {
  const { password, ...userWithoutPassword } = user;
  return userWithoutPassword;
}

function generarToken(id, expire, action) {
  return jwt.sign({ sub: id, action }, process.env.JWT_SECRET, { expiresIn: expire });
}
