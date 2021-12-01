'use strict';

const { EggApplication } = require('egg');
const ioredis = require('ioredis');
const rd = require('./lib/redis');

const { MSG_TARGET } = require('./common');
const path = require('path');

/** schex Manager for message
 *
 */
class MsgManagerApp {

  /**
   * @param {object} opt 配置
   * @param {EggApplication} app app
   * @param {ioredis.Redis} redisIns redis 实例
   */
  constructor(opt, app, redisIns) {
    this.ctx = app.createAnonymousContext();
    this.opt = opt;
    this.app = app;
    this.logger = app.getLogger('schexLogger');
    this._cb = null;
    /** @type {ioredis.Redis} */
    this.rs = redisIns;

    this.chs = [];
    this.msgs = {};

    this.loadMsg();
    this.rs.subscribe(...this.chs);

    this.rs.on('message', (channel, message) => { this._onMsg(channel, message); });
    this.logger.info('[schex-ap] start init ...');
  }

  async _onMsg(channel, message) {
    try {
      const msg = JSON.parse(message);
      let Msg = this.app[MSG_TARGET];
      Msg = Msg[ this.msgs[channel]];

      const instance = new Msg(this.app, this.ctx);
      await instance.run(msg, channel);
    } catch (error) {
      this.app.coreLogger.error('[schex] msg error: %s', error);
      return Promise.reject(error);
    }
  }

  loadMsg() {
    const cfg = this.opt.message;
    const jobDir = path.join(this.app.baseDir, 'app', cfg.baseDir);
    const msgs = {};
    const chs = [];
    this.app.loader.loadToApp(jobDir, MSG_TARGET, {
      ignore: cfg.ignore,
      filter: job => job.isMsg,
      initializer(job, pathInfo) {
        const name = pathInfo.pathName.replace(cfg.baseDir + '.', '');
        const queue = job.channel;
        msgs[queue] = name;
        chs.push(queue);
        return job;
      },
    });

    this.msgs = msgs;
    this.chs = chs;
  }

}

module.exports = MsgManagerApp;

//
