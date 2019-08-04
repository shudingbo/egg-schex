'use strict';


const ioredis = require('ioredis');
const fs = require('fs');
const path = require('path');


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
    this.redis = null;
    this._cb = null;
    this.sc = sc;
    this.logger = sc.logger;
    this.timerChk = null;
    this.timerChkInterval = 5000;
    this.cfgUpdateTime = {}; // / 记录各个job的更新时间
    this.cfg = opt;
    this.upJobs = []; // ! 要更新的Job列表
    this.jobCfgs = {}; // ! 各个任务的配置文件

    if (opt.checkInterval !== undefined) {
      this.timerChkInterval = opt.checkInterval;
    }

    this.keyChk = opt.keyPre + ':updateTime';
    this.keyJobs = opt.keyPre + ':jobs';
    this.keyStatus = opt.keyPre + ':status';
    this.keyCfg = opt.keyPre + ':cfg';
  }


  /**
   * Start Monitor the schedule job's change.
   *
   * @param  {Function} cb when schedule change,will trigger call this CB.
   */
  start_monitor(cb) {
    this._cb = cb;
    connectRedis(this);
  }


  stop_monitor() {
    disconnectRedis(this);
  }

  /** Update Job Status
   *
   * @param  {int} handleType @see const.js STA.
   * @param  {object} job  job object
   */
  update_Job(handleType, job) {
    const cfg = {
      status: job.status,
      latestHandleType: handleType,
      latestHandleTime: Math.floor(Date.now() / 1000),
      startTime: job.startTime,
      stopTime: job.stopTime,
      latestRunTime: job.latestRunTime,
      nextRunTime: job.nextRunTime,
      msg: job.msg,
    };

    if (job.parent !== undefined && job.parent !== null) {
      cfg.parent = job.parent.name;
    }

    this.redis.hset(this.keyStatus, job.name, JSON.stringify(cfg));
  }

  /** Update Job's msg
   * @param {String} jobName Job's Name
   * @param {String} msg  Update msg
   */
  update_msg(jobName, msg) {
    const self = this;

    this.redis.hget(this.keyStatus, jobName, (err, reply) => {
      // self.logger.info('-- get config',err,reply );
      if (err === null && reply !== null) {
        const cfg = JSON.parse(reply);
        cfg.msg = msg;
        // self.logger.info('-- get Status', cfg );
        self.redis.hset(self.keyStatus, jobName, JSON.stringify(cfg));
      }
    });
  }


  getConfig(jobName) {
    // this.logger.info( this.jobCfgs  );
    if (this.jobCfgs[ jobName ] !== undefined) {
      return this.jobCfgs[jobName];
    }

    return {};
  }


  removeJob(jobName) {
    this.redis.hdel(this.keyStatus, jobName);
  }


  async getJobs() {
    const jobs = await this.redis.hgetall(this.keyJobs);
    const status = await this.redis.hgetall(this.keyStatus);

    return { jobs, status };
  }

  async startJob(jobName, jobBase, msg) {
    await this.redis.hset(this.keyJobs, jobName, JSON.stringify(jobBase));
    await this.redis.hset(this.keyChk, jobName, Math.floor(Date.now() / 1000));
    this.update_msg(jobName, msg);
  }

  async stopJob(jobName, jobBase, msg) {
    await this.redis.hset(this.keyJobs, jobName, JSON.stringify(jobBase));
    await this.redis.hset(this.keyChk, jobName, Math.floor(Date.now() / 1000));
    this.update_msg(jobName, msg);
  }

  async addJob(jobCfg) {
    const jobName = jobCfg.name;
    const base = jobCfg.base;
    const cfg = jobCfg.cfg;

    await this.redis.hset(this.keyJobs, jobName, JSON.stringify(base));
    await this.redis.hset(this.keyCfg, jobName, JSON.stringify(cfg));
    await this.redis.hset(this.keyChk, jobName, Math.floor(Date.now() / 1000));
  }

  async updateJob(jobCfg) {
    const jobName = jobCfg.name;
    let hasChange = false;
    if (jobCfg.base !== undefined) {
      await this.redis.hset(this.keyJobs, jobName, JSON.stringify(jobCfg.base));
      hasChange = true;
    }

    if (jobCfg.cfg !== undefined) {
      await this.redis.hset(this.keyCfg, jobName, JSON.stringify(jobCfg.cfg));
      hasChange = true;
    }

    if (hasChange === true) {
      await this.redis.hset(this.keyChk, jobName, Math.floor(Date.now() / 1000));
      this.update_msg(jobName, 'Update Job');
    }
  }

  async deleteJob(jobName) {
    const staAll = await this.redis.hgetall(this.keyStatus);
    const jobSub = [];
    if (staAll !== null) {
      for (const it in staAll) {
        const t = JSON.parse(staAll[it]);
        if (t.parent !== undefined && t.parent === jobName) {
          jobSub.push(it);
        }
      }
    }

    const pipe = this.redis.pipeline();
    pipe.hdel(this.keyJobs, jobName);
    pipe.hdel(this.keyStatus, jobName);
    for (const it of jobSub) {
      pipe.hdel(this.keyStatus, it);
      pipe.hdel(this.keyChk, it);
    }
    pipe.hdel(this.keyCfg, jobName);
    await pipe.exec();
    return `${jobName} has delete`;
  }

}// end class RedisDrv

module.exports = RedisDrv;

function cfgChange(self) {
  const upJobs = self.upJobs.slice(0);
  self.upJobs = [];

  const len = upJobs.length;
  for (let i = 0; i < len; i++) {
    getCfgFromDB(self, upJobs[i]);
  }
}

function getCfgFromDB(self, jobName) {
  self.redis.hget(self.keyJobs, jobName, function(err, reply) {
    if (err === null && reply !== null) {
      const schedules = {};
      schedules[ jobName ] = JSON.parse(reply);

      // / 加载配置文件
      self.redis.hget(self.keyCfg, jobName, function(err, reply) {
        if (err === null && reply !== null) {
          self.jobCfgs[ jobName ] = JSON.parse(reply);
          if (self._cb !== null) {
            self._cb(schedules);
          }
        }
      });
    }
  });
}

function initData(self) {
  self.logger.info('[schex-ag] Connect to redis.');

  if (self.timerChk != null) {
    clearInterval(self.timerChk);
  }

  (async () => {
    try {
      await initUpdateTime(self);
      self.timerChk = setInterval(function() {
        checkCfg(self);
      }, self.timerChkInterval);
    } catch (err) {
      self.logger.warn('[schex-ag] initUpdateTime: ', err);
    }
  })();
}

function connectRedis(self) {
  const redisConn = {
    host: self.cfg.host,
    port: self.cfg.port,
    db: self.cfg.db,
  };

  if (self.cfg.password !== undefined) {
    redisConn.password = self.cfg.password;
  }

  self.redis = new ioredis(redisConn);
  self.redis.on('error', function(err) {
    self.logger.warn('[schex-ag] Error ' + err);

  });

  self.redis.on('connect', function(err) {
    if (!err) {
      initData(self);
    }
  });
}

async function initUpdateTime(self) {
  const replySta = await self.redis.hgetall(self.keyStatus);

  for (const sta in replySta) {
    const t = JSON.parse(replySta[sta]);
    if (t.parent !== undefined) {
      self.redis.hdel(self.keyStatus, sta);
    }
  }

  if (self.cfg.jobInitCfg !== undefined && typeof (self.cfg.jobInitCfg) === 'string') {
    const cfgPath = path.resolve('./config/' + self.cfg.jobInitCfg);
    const initJob = fs.readFileSync(cfgPath, 'utf-8');
    const cfg = JSON.parse(initJob);
    const tm = Math.floor(Date.now() / 1000);
    for (const it in cfg) {
      await self.redis.hset(self.keyJobs, it, JSON.stringify(cfg[it].base));
      await self.redis.hset(self.keyCfg, it, JSON.stringify(cfg[it].cfg));
      await self.redis.hset(self.keyChk, it, tm);
    }
  }

  // /
  const pipe = self.redis.pipeline();
  pipe.hgetall(self.keyCfg);
  pipe.hgetall(self.keyJobs);
  pipe.hgetall(self.keyChk);
  const rets = await pipe.exec();

  let jobCfgs = {};
  let jobs = {};
  let jobChks = {};
  if (rets[0][0] === null) {
    jobCfgs = rets[0][1];
  }

  if (rets[1][0] === null) {
    jobs = rets[1][1];
  }

  if (rets[2][0] === null) {
    jobChks = rets[2][1];
  }

  // / 初始化 Job
  const curTM = Math.floor(Date.now() / 1000);
  const pipeUp = self.redis.pipeline();
  const jobInfos = {};
  for (const jobName in jobs) {
    const jobInfo = JSON.parse(jobs[jobName]);
    let cfg = {};
    if (jobCfgs[ jobName ] !== undefined) {
      cfg = JSON.parse(jobCfgs[jobName]);
    }

    self.jobCfgs[ jobName ] = cfg;

    if (jobChks[jobName] !== undefined) {
      self.cfgUpdateTime[ jobName ] = parseInt(jobChks[jobName]);
    } else {
      pipeUp.hset(self.keyChk, jobName, curTM);
      self.cfgUpdateTime[ jobName ] = curTM;
    }

    jobInfos[jobName] = jobInfo;
  }

  await pipeUp.exec();
  if (self._cb !== null) {
    self._cb(jobInfos);
  }
}

function disconnectRedis(self) {
  if (self.timerChk !== null) {
    clearInterval(self.timerChk);
  }

  if (self.cfg.instanse === undefined) {
    self.redis.quit();
  }
  self.logger.info('[schex-ag] DisConnect from redis.');
}

function checkCfg(self) {
  self.redis.hgetall(self.keyChk, function(err, reply) {
    if (err === null && reply !== null) {
      for (const sc in reply) {
        if (reply[sc] != self.cfgUpdateTime[sc]) {
          self.logger.info(`[schex-ag] job cfg [${sc}] has change.`);

          self.upJobs.push(sc);
          self.cfgUpdateTime[sc] = reply[sc];
        }
      }

      cfgChange(self);
    }
  });
}

