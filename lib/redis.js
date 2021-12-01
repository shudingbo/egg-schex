'use strict';

const ioredis = require('ioredis');

/** schex Manafer for APP
 *
 */
class RedisDrv {

  /**
   * @class
   *
   * Redis config manager module
   * @param {Object} opt json 对象
   * @param {SchexManagerAgent} sc 上层管理对象
   */
  constructor(opt, sc) {
    /** @type {ioredis.Redis} */
    this._redis = null;
    this.sc = sc;
    this.logger = sc.logger;
    this.cfg = opt;
  }

  /** @type {ioredis.Redis} */
  get redis() {
    return this._redis;
  }

  /**
   * Start Monitor the schedule job's change.
   */
  start() {
    return connectRedis(this);
  }

  stop() {
    disconnectRedis(this);
  }


}// end class RedisDrv

module.exports = RedisDrv;

function connectRedis(self) {
  const redisConn = {
    host: self.cfg.host,
    port: self.cfg.port,
    db: self.cfg.db,
  };

  if (self.cfg.password !== undefined) {
    redisConn.password = self.cfg.password;
  }

  return new Promise((resolve, reject) => {
    self._redis = new ioredis(redisConn);
    self._redis.on('error', function(err) {
      self.logger.warn('[schex-ap] Error ' + err);
      reject(new Error('[schex-ap] Error ' + err));
    });

    self._redis.on('connect', function(err) {
      if (!err) {
        resolve();
      } else {
        self.logger.warn('[schex-ap] Error ' + err);
        reject(new Error('[schex-ap] Error ' + err));
      }
    });
  });

}


function disconnectRedis(self) {
  if (self.cfg.instanse === undefined) {
    self._redis.quit();
  }
  self.logger.info('[schex-ap] DisConnect from redis.');
}

