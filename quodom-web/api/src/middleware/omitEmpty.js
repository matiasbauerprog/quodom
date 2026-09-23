// Joi's .empty('') / .empty(null) removed the key, so "no value" meant "don't
// touch it". OpenAPI passes '' and null through; this keeps the old meaning for
// the fields that relied on it.
module.exports = function omitEmpty(fields, values = ['']) {
  return function (req, res, next) {
    if (req.body && typeof req.body === 'object') {
      for (const f of fields) {
        if (values.includes(req.body[f])) delete req.body[f];
      }
    }
    next();
  };
};
