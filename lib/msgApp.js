'use strict';


const sc = require('./msgManagerApp'); // -- you code here require is 'sdb_schedule'

module.exports = app => {
  app.addSingleton('msgx', createClient);
};

async function createClient(config, app) {
  // test config
  // app.coreLogger.info('[egg-scheX] connecting %s@%s:%s/%s', config.user, config.server, config.port, config.database);

  console.log(111111);
  /** @type {sc} */

  const cli = new sc({
    cfg_drv: 'redisdrv.js',
    cfg_opt: config,
  }, app);

  // 做启动应用前的检查
  app.beforeStart(async function startMssql() {
    app.coreLogger.info('[schex msg app] instance status OK');
  });
  return cli;
}
