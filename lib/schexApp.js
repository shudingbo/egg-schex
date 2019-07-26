'use strict';


const sc = require('./schexManagerApp'); // -- you code here require is 'sdb_schedule'


module.exports = app => {
  app.addSingleton('schex', createClient);
};

let count = 0;

async function createClient(config, app) {
  console.log('app:',222222222);
  // test config
  // app.coreLogger.info('[egg-scheX] connecting %s@%s:%s/%s', config.user, config.server, config.port, config.database);

  let cli = null;
  if (cli === null) {
    cli = sc({}, app);
  }


  // 做启动应用前的检查
  app.beforeStart(async function startMssql() {
    const index = count++;
    app.coreLogger.info(`[egg-scheX] instance[${index}] status OK`);
  });
  return cli;
}
