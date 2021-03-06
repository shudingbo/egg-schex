'use strict';


const sc = require('./schexManagerAgent'); // -- you code here require is 'sdb_schedule'


module.exports = agent => {
  agent.addSingleton('schex', createClient);
};

async function createClient(config, agent) {
  // test config
  // agent.coreLogger.info('[egg-scheX] connecting %s@%s:%s/%s', config.user, config.server, config.port, config.database);

  /** @type {sc} */
  let cli = null;
  if (cli === null) {
    cli = new sc({
      cfg_drv: 'redisdrv.js',
      cfg_opt: config,
    }, agent);
  }

  // 做启动应用前的检查
  agent.beforeStart(async function startMssql() {
    agent.coreLogger.info('[schex agent] instance status OK');
  });
  return cli;
}
