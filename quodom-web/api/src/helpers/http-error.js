// Thrown values that carry their own HTTP status, so controllers can answer 409
// (and friends) without every route mapping error strings by hand.
function httpError(status, error, message, extra = {}) {
    return { status, error, message, ...extra };
}

module.exports = { httpError };
