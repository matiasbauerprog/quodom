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
    validateResponses: false, // turned on for tests in Task 6
    validateSecurity: false, // auth stays in middleware/auth.js
    ignorePaths: /^\/img\//,
    serDes: [OpenApiValidator.serdes.dateTime]
  });
}

module.exports = { SPEC_PATH, buildValidator };
