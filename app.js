'use strict';
//const scA = require('./lib/schexApp');

// module.exports = app => {
//   // register schedule event
//   app.messenger.on('egg-schex', (...args) => {
//     app.schex.onJobEvt(...args);
//   });

//   app.messenger.once('egg-ready', () => {
//     // start schedule after worker ready
//     //scA(app);
//     console.log('22222222222');
//     msgA(app);
//   });
// };


const msg = require('./lib/msgManagerApp'); // -- you code here require is 'sdb_schedule'
const rd = require('./lib/redis');
module.exports = app => {
  app.addSingleton('schex', createClient);
};

async function createClient(config, app) {
  // test config
  // app.coreLogger.info('[egg-scheX] connecting %s@%s:%s/%s', config.user, config.server, config.port, config.database);

  const rs = new rd(config, app);
  await rs.start();

  const cli = new msg(config, app, rs.redis);

  // 做启动应用前的检查
  app.beforeStart(async function startMssql() {
    app.coreLogger.info('[schex msg app] instance status OK');
  });
  return { msg: cli };
}

