export const config = { runtime: 'nodejs', maxDuration: 25 };

export default async function handler(req, res) {
  const results = [];
  const start = Date.now();

  function log(msg) { results.push('[' + (Date.now() - start) + 'ms] ' + msg); }

  try {
    log('3rd party packages OK (tested separately)');

    log('importing ../src/config/env.js...');
    const envMod = await import('../src/config/env.js');
    log('env OK, keys: ' + Object.keys(envMod.env || {}).join(','));

    log('importing ../src/utils/logger.js...');
    await import('../src/utils/logger.js');
    log('logger OK');

    log('importing ../src/db/schema.js...');
    await import('../src/db/schema.js');
    log('schema OK');

    log('importing ../src/db/index.js...');
    await import('../src/db/index.js');
    log('db OK');

    log('importing ../src/services/user.service.js...');
    await import('../src/services/user.service.js');
    log('user.service OK');

    log('importing ../src/bot/bot.js...');
    await import('../src/bot/bot.js');
    log('bot OK');

    log('importing ../src/client/html.js...');
    await import('../src/client/html.js');
    log('html OK');

    log('importing ../src/api/server.js...');
    const serverMod = await import('../src/api/server.js');
    log('server OK, exports: ' + Object.keys(serverMod).join(','));

    log('ALL DONE');
    res.status(200).json({ ok: true, results });
  } catch (err) {
    log('ERROR: ' + (err && err.message));
    res.status(500).json({ ok: false, results, error: err && err.message, stack: err && err.stack });
  }
}
