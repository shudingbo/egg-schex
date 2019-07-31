'use strict';


const sc = require('./schexManagerApp'); // -- you code here require is 'sdb_schedule'


module.exports = app => {
  app.addSingleton('schex', createClient);
};

async function createClient(config, app) {
  // test config
  // app.coreLogger.info('[egg-scheX] connecting %s@%s:%s/%s', config.user, config.server, config.port, config.database);

  /** @type {sc} */
  let cli = null;
  if (cli === null) {
    cli = new sc({}, app);
  }

  // 做启动应用前的检查
  app.beforeStart(async function startMssql() {
    app.coreLogger.info('[schex app] instance status OK');
  });
  return cli;
}
