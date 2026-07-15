const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const rateLimit = require('../middleware/rateLimit');
const Controler = require('../controllers/ia.controller');

const MAX_TURNS = () => parseInt(process.env.IA_MAX_TURNS || '20', 10);
const MAX_USER_MSG = () => parseInt(process.env.IA_MAX_USER_MESSAGE_LENGTH || '500', 10);
const MAX_DAILY = () => parseInt(process.env.IA_MAX_DAILY_MESSAGES || '50', 10);
const MAX_RPM = () => parseInt(process.env.IA_RATE_LIMIT_PER_MINUTE || '10', 10);

router.post(
  '/chat',
  auth.verifyToken(),
  (req, res, next) => rateLimit.perUserPerMinute(MAX_RPM())(req, res, next),
  chat
);

module.exports = router;

async function chat(req, res, next) {
  try {
    const messages = Array.isArray(req.body && req.body.messages) ? req.body.messages : null;
    if (!messages || messages.length === 0) {
      return res.status(400).json({ res: false, error: 'no_last_user_message', message: 'Falta el mensaje del usuario.' });
    }
    if (messages.length > MAX_TURNS() * 2) {
      return res.status(400).json({ res: false, error: 'too_many_turns', message: 'Esta conversación llegó al máximo de turnos. Empezá una nueva.' });
    }
    const last = messages[messages.length - 1];
    if (!last || last.role !== 'user' || typeof last.text !== 'string') {
      return res.status(400).json({ res: false, error: 'no_last_user_message', message: 'El último mensaje debe ser del usuario.' });
    }
    if (last.text.length > MAX_USER_MSG()) {
      return res.status(400).json({ res: false, error: 'too_long', message: 'Tu mensaje es muy largo (máx ' + MAX_USER_MSG() + ' caracteres).' });
    }

    const currentCount = await Controler.getDailyCount(req.user.id);
    if (currentCount >= MAX_DAILY()) {
      return res.status(429).json({ res: false, error: 'limit_exceeded', message: 'Alcanzaste el límite diario (' + MAX_DAILY() + ' mensajes). Volvé mañana o usá el buscador.' });
    }

    let reply;
    try {
      reply = await Controler.chat(req.user.id, messages);
    } catch (e) {
      return res.status(500).json({ res: false, error: 'ia_unavailable', message: 'El asistente no está disponible por ahora. Probá de nuevo en un momento.' });
    }

    await Controler.incrementDaily(req.user.id);
    return res.json(reply);
  } catch (e) {
    next(e);
  }
}
