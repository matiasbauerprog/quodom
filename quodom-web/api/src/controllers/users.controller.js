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
  verifyResetToken,
  changePass,
  delete: _delete
};

const emailEnabled = () => process.env.EMAIL_ENABLED === 'true';

// reset and reenviar answer the same whether or not the account exists, so
// neither can be used to find out who is registered.
const RESET_SENT = { res: true, message: 'Si el e-mail o usuario está registrado, te enviamos un link para blanquear la contraseña. Dura 1 hora.' };
const VALIDATION_SENT = { res: true, message: 'Si el correo está registrado y falta validarlo, te reenviamos el link.' };

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

  const token = generarToken(user.id, '72h', 'validar');
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
  const user = await db.User.scope('withHash').findOne({
    where: {
      [Op.or]: [{ email: params.email }, { username: params.email }]
    }
  });

  if (!user || !user.activo || !user.emailValidado) return RESET_SENT;

  const token = jwt.sign({ sub: user.id, action: 'resetpass' }, resetSecret(user), { expiresIn: '1h' });
  const link = process.env.APP_URL + '/reset/' + token;
  const ret = await correo.sendEmail(user, link, 'Restablecer contraseña QUODOM', 'reset-password');
  if (!ret) console.log('[reset] email could not be sent to user ' + user.id);

  return RESET_SENT;
}

// The reset token is signed with the user's current password hash mixed into
// the secret: changing the password invalidates every link issued before, so
// a link works once. It also means a reset token never verifies as a session.
function resetSecret(user) {
  return process.env.JWT_SECRET + ':' + user.password;
}

async function verifyResetToken(token) {
  const expired = 'El token ha expirado, genere uno nuevo ingresando a ¿Olvidaste tu clave?';
  const invalid = 'El link no es valido o ya fue usado, genere uno nuevo ingresando a ¿Olvidaste tu clave?';

  const claims = jwt.decode(token);
  if (!claims || claims.action !== 'resetpass' || !claims.sub) throw invalid;

  const user = await db.User.scope('withHash').findByPk(claims.sub);
  if (!user) throw invalid;

  try {
    jwt.verify(token, resetSecret(user), { algorithms: ['HS256'] });
  } catch (err) {
    throw err.name === 'TokenExpiredError' ? expired : invalid;
  }
  if (!user.activo) throw 'El Usuario se encuentra actualmente bloqueado.';
  return user;
}

async function validateEmail(id) {
  const user = await getUser(id);

  if (user.emailValidado) throw 'El correo ya se encuentra validado.';

  return await user.update({ emailValidado: true });
}

async function reenviar(params) {
  const user = await db.User.findOne({ where: { email: params.email } });
  if (!user || user.emailValidado) return VALIDATION_SENT;

  const token = generarToken(user.id, '72h', 'validar');
  const link = process.env.APP_URL + '/validar-email/' + token;
  const ret = await correo.sendEmail(user, link, 'Verifica tu correo electrónico', 'validar-email');
  if (!ret) console.log('[reenviar] email could not be sent to user ' + user.id);

  return VALIDATION_SENT;
}

async function _delete(id) {
  const user = await getUser(id);
  await user.destroy();
}

async function changePass(token, params) {
  const user = await verifyResetToken(token);
  const password = await bcrypt.hash(params.password, 10);
  return await user.update({ password });
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

async function getInfoComprador(userId, idquodom) {
  const own = await db.Quodom.findOne({ where: { id: idquodom, createdBy: userId }, attributes: ['id'] });
  if (!own) return null;
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
