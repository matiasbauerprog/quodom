const path = require('path');
const OpenApiValidator = require('express-openapi-validator');

const SPEC_PATH = path.join(__dirname, '..', '..', 'openapi.yaml');

// openapi.yaml is the contract; this is the one place that decides how it is
// enforced. Requests: always, dropping undeclared body fields (that is what
// stops `role: "admin"` on PUT /users). Responses: only under tests, so a
// field the contract forgot fails a test instead of a user's request.
function buildValidator() {
  return OpenApiValidator.middleware({
    apiSpec: SPEC_PATH,
    validateRequests: { removeAdditional: 'all', allErrors: true },
    validateResponses: process.env.NODE_ENV === 'test',
    validateSecurity: false, // auth stays in middleware/auth.js
    ignorePaths: /^\/(img|docs)(\/|$)/,
    serDes: [OpenApiValidator.serdes.dateTime]
  });
}

// The response validator inspects the object passed to res.json, before
// JSON.stringify runs toJSON() on Sequelize instances. Give it what the client
// actually receives.
function plainJson(req, res, next) {
  const json = res.json.bind(res);
  res.json = body => json(body === undefined ? body : JSON.parse(JSON.stringify(body)));
  next();
}

module.exports = { SPEC_PATH, buildValidator, plainJson };
