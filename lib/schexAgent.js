'use strict';


const sc = require('./schexManagerAgent'); // -- you code here require is 'sdb_schedule'


module.exports = agent => {
  agent.addSingleton('schex', createClient);
};

let count = 0;

async function createClient(config, agent) {
  console.log('agent:',11111111111);
  // test config
  // agent.coreLogger.info('[egg-scheX] connecting %s@%s:%s/%s', config.user, config.server, config.port, config.database);

  let cli = null;
  if (cli === null) {
    cli = sc({
      cfg_drv: 'redisdrv.js',
      cfg_opt: config,
    }, agent);
  }


  // 做启动应用前的检查
  agent.beforeStart(async function startMssql() {
    const index = count++;
    agent.coreLogger.info(`[egg-scheX] instance[${index}] status OK`);
  });
  return cli;
}
