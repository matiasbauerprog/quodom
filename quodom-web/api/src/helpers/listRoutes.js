// Lists every route the Express app answers, in OpenAPI path syntax, so a
// test can compare the code against openapi.yaml. Relies on Express 4
// internals (app._router.stack); if Express is upgraded, this is the file
// that breaks, loudly, in tests.
function prefixOf(layer) {
  // Express 4 compiles app.use('/users', router) to /^\/users\/?(?=\/|$)/i
  const src = layer.regexp.source;
  if (src === '^\\/?(?=\\/|$)') return '';
  return src
    .replace(/^\^/, '')
    .replace(/\\\/\?\(\?=\\\/\|\$\)$/, '')
    .replace(/\\\//g, '/');
}

function normalize(path) {
  const p = path.replace(/:(\w+)/g, '{$1}').replace(/\/+$/, '');
  return p === '' ? '/' : p;
}

function listRoutes(app) {
  const out = [];
  for (const layer of app._router.stack) {
    if (layer.route) {
      for (const method of Object.keys(layer.route.methods)) {
        if (method === '_all') continue;
        out.push({ method, path: normalize(layer.route.path) });
      }
    } else if (layer.name === 'router' && layer.handle.stack) {
      const prefix = prefixOf(layer);
      for (const sub of layer.handle.stack) {
        if (!sub.route) continue;
        for (const method of Object.keys(sub.route.methods)) {
          out.push({ method, path: normalize(prefix + sub.route.path) });
        }
      }
    }
  }
  return out.filter(r => r.path !== '*' && !r.path.startsWith('/img') && !r.path.startsWith('/docs'));
}

module.exports = { listRoutes };
