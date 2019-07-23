'use strict';

const assert = require('assert');
const sc = require('sdb-schedule'); // -- you code here require is 'sdb_schedule'


module.exports = app => {
  app.addSingleton('schex', createClient);
};

let count = 0;

async function createClient(config, app) {
  // test config
  // assert(config.server && config.port && config.user && config.database, `[egg-scheX] 'server: ${config.server}', 'port: ${config.port}', 'user: ${config.user}', 'database: ${config.database}' are required on config`);
  // app.coreLogger.info('[egg-scheX] connecting %s@%s:%s/%s', config.user, config.server, config.port, config.database);
  const logger = {
    info: (...msg) => { app.logger.info('[scheX]', ...msg); },
    warn: (...msg) => { app.logger.warn('[scheX]', ...msg); },
  };

  let cli = null;
  if ((config.redisInstanseName !== undefined) && (typeof (config.redisInstanseName) === 'string')) {

    const _redis = { ins: app[config.redisInstanseName] };
    config.instanse = _redis;
  }

  if (cli === null) {
    cli = sc({
      cfg_drv: 'redisdrv.js',
      cfg_opt: config,
      logger,
    }, app);
  }


  // 做启动应用前的检查
  app.beforeStart(async function startMssql() {
    const index = count++;
    app.coreLogger.info(`[egg-scheX] instance[${index}] status OK`);
  });
  return cli;
}
