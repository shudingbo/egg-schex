'use strict';

const schedule = require('node-schedule');
const fs = require('fs');
const path = require('path');
const con = require('./const.js');
const CornParser = require('cron-parser');


/** schex Manafer for Agent
 *
 */
class SchexManagerAgent {

  constructor(opt, agent) {
    const self = this;
    this.condef = con;
    this.jobStep = con.JobStep;
    this.agent = agent;
    this.logger = agent.getLogger('schexLogger');
    const drv = require(path.resolve(__dirname + '/drv/' + opt.cfg_drv));
    this.drv = new drv(opt.cfg_opt, this);

    this.schedules = {};

    this.drv.start_monitor(function(schedulesCfg) {
      self.checkSchedulesCfg(schedulesCfg);
    });

    this.logger.info('[schex-ag] start init ...');
  }

  /** send action to APP
	 *
	 * @param {Object} job job Object
	 * @param {Number} step  job step
	 * @param {Object} addInfo add info
	 */
  runAction(job, step, addInfo) {
    const info = {
      name: job.name,
      fun: job.fun,
      parent: (job.parent !== null) ? job.parent.name : null,
      cfg: this.getConfig(job.name),
      step,
      ctx: job.ctx,
    };

    if (job.parent !== null) {
      info.ctx = job.parent.ctx;
    }

    if (addInfo !== undefined) {
      Object.assign(info, addInfo);
    }

    if (step === this.jobStep.STOP) {
      this.agent.messenger.sendToApp('egg-schex', info);
    } else {
      this.agent.messenger.sendRandom('egg-schex', info);
    }
  }

  /** Send action to All egg worker
	 *
	 * @param {Object} evtInfo evt object
	 * @param {Number} evtInfo.method 发送的方法
	 */
  runActionToAll(evtInfo) {
    this.agent.messenger.sendToApp('egg-schex', evtInfo);
  }

  /** handle evt from app
	 *
	 * @param {Object} evtInfo evtInfo
	 */
  onJobEvt(evtInfo) {
    this.logger.debug(`[schex-ag] ${evtInfo.name} ${evtInfo.step}`, evtInfo.ctx);

    if (evtInfo.method !== undefined) {
      this.evtMethod(evtInfo);
    } else {
      switch (evtInfo.step) {
        case this.jobStep.INIT:
          this.evtInit(evtInfo);
          break;
        case this.jobStep.RUN:
          this.evtRun(evtInfo);
          break;
        case this.jobStep.STOP:
          this.evtStop(evtInfo);
          break;
        default:break;
      }
    }
  }

  evtMethod(evtInfo) {
    switch (evtInfo.method) {
      case con.Method.ctlSta:
      case con.Method.ctlAddJob:
      case con.Method.ctlDelJob:
      case con.Method.ctlUpdateJob:
      case con.Method.ctlStartJob:
      case con.Method.ctlStopJob:
        this.onEvtCtl(evtInfo);
        return;
      default: break;
    }

    // ////////////
    const jobP = this.schedules[ evtInfo.name ];
    if (jobP !== undefined) {
      switch (evtInfo.method) {
        case con.Method.add:
          {
            const ret = addSubJob(this, evtInfo.addInfo.name, evtInfo.addInfo);
            if (ret === con.AddCode.OK || ret === con.AddCode.Exist) {
              this.evtInit(evtInfo.addInfo);
              jobP.msg = `SubJob ${evtInfo.name} is starting...`;
              this.drv.update_Job(con.STA.RUN, jobP);
            } else {
              jobP.msg = `SubJob ${evtInfo.name} is starting err:${ret}`;
              this.drv.update_Job(con.STA.EXCEPTION, jobP);
            }
            this.logger.info('[schex-ag] ' + jobP.msg);
          } break;
        case con.Method.stop:
          this.stopJob(jobP.name, jobP.msg);
          break;
        case con.Method.info:
          if (jobP.parent !== null) {
            const p = jobP.parent;
            evtInfo.parent = {
              name: p.name,
              fun: p.fun,
              cfg: this.getConfig(p.name),
            };
            evtInfo.ctx = p.ctx;
          }
          this.runActionToAll(evtInfo);
          break;
        case con.Method.ctlAddJob:
        case con.Method.ctlDelJob:
        case con.Method.ctlUpdateJob:
        case con.Method.ctlStartJob:
        case con.Method.ctlStopJob:
          this.onEvtCtl(evtInfo);
          break;
        default: break;
      }
    }
  }


  evtInit(evtInfo) {

    const job = this.schedules[ evtInfo.name ];
    if (job.parent === null && job.hasInit === true) { // Other worker job init OK.
      return;
    }
    if (evtInfo.err !== undefined && evtInfo.err !== null) {
      this.logger.warn(`[schex-ag] job ${evtInfo.name} init err:${evtInfo.msg}`);
      this.drv.update_Job(con.STA.EXCEPTION, job);
      return;
    }

    if (job.parent === null) {
      job.ctx = evtInfo.ctx;
    }

    // /
    const self = this;
    job.job = schedule.scheduleJob(job.cron, () => {
      self.runAction(job, con.JobStep.RUN, {});
    });

    if (job.job !== null) {
      job.status = true;
      job.hasInit = true;
      job.startTime = Math.floor(Date.now() / 1000);
      job.stopTime = 0;
      job.nextRunTime = getNextRunTime(job.cron);
      job.msg = '';
    } else {
      job.status = false;
      job.startTime = 0;
      job.stopTime = 0;
      job.nextRunTime = 0;
      job.msg = 'corn parse error.';
    }

    self.drv.update_Job(con.STA.START, job);

    if (job.parent !== null && job.parent !== undefined) {
      self.logger.info(`[schex-ag] run Sub Job [ ${job.name} ]`);
    } else {
      self.logger.info(`[schex-ag] run Job [ ${job.name} ]`);
    }
  }


  evtRun(evtInfo) {
    const job = this.schedules[ evtInfo.name ];
    // /////////
    if (evtInfo.err !== null) {
      this.logger.warn(`[schex-ag] job ${evtInfo.name} run err:${evtInfo.msg}`);
      this.drv.update_Job(con.STA.EXCEPTION, job);
      return;
    }

    //
    if (job.parent === null) {
      job.ctx = evtInfo.ctx;
    } else {
      job.parent.ctx = evtInfo.ctx;
    }

    if (evtInfo.msg !== undefined) {
      job.msg = evtInfo.msg;
    }

    job.latestRunTime = Math.floor(Date.now() / 1000);
    job.nextRunTime = getNextRunTime(job.cron);
    this.drv.update_Job(con.STA.RUN, job);
  }

  evtStop(evtInfo) {
    const job = this.schedules[ evtInfo.name ];

    if (evtInfo.err !== null) {
      this.logger.warn(`[schex-ag] job ${evtInfo.name} stop err:${evtInfo.msg}`);
      this.drv.update_Job(con.STA.EXCEPTION, job);
      return;
    }

    //
    if (job.parent === null) {
      job.ctx = evtInfo.ctx;
    } else {
      job.parent.ctx = evtInfo.ctx;
    }

    if (evtInfo.msg !== undefined) {
      job.msg = evtInfo.msg;
    }

    if (job.restaring === true) {
      job.restaring = false;
      runJob(this, job);
    }
  }

  /** 处理控制信息 */
  onEvtCtl(evtInfo) {
    let job = null;
    if (evtInfo.method !== con.Method.ctlSta) {
      job = this.schedules[ evtInfo.name ];
      if (job === undefined) {
        evtInfo.status = false;
        evtInfo.msg = `${evtInfo.name} not exist..`;
        this.agent.messenger.sendTo(evtInfo.pid, 'egg-schex', evtInfo);
        return;
      }
    }


    switch (evtInfo.method) {
      case con.Method.ctlSta:
        (async () => {
          try {
            const data = await this.drv.getJobs();
            evtInfo.data = data;
            evtInfo.status = true;
            this.agent.messenger.sendTo(evtInfo.pid, 'egg-schex', evtInfo);
          } catch (e) {
            evtInfo.status = false;
            evtInfo.msg = e.toString();
            this.agent.messenger.sendTo(evtInfo.pid, 'egg-schex', evtInfo);
          }
        })();
        break;
      case con.Method.ctlAddJob:
      case con.Method.ctlDelJob:
      case con.Method.ctlUpdateJob:
      case con.Method.ctlStartJob:
        {
          if (job.status === true) {
            evtInfo.status = true;
            evtInfo.msg = `${evtInfo.name} is running..`;
            this.agent.messenger.sendTo(evtInfo.pid, 'egg-schex', evtInfo);
            return;
          }
          const jobBase = {
            cron: job.cron,
            fun: job.fun,
            switch: true,
          };

          this.drv.startJob(job.name, jobBase, 'Remote Start');
          evtInfo.status = true;
          evtInfo.msg = 'receive start command';
          this.agent.messenger.sendTo(evtInfo.pid, 'egg-schex', evtInfo);

        } break;
      case con.Method.ctlStopJob:
        {
          if (job.status === false) {
            evtInfo.status = true;
            evtInfo.msg = `${evtInfo.name} has stoped`;
            this.agent.messenger.sendTo(evtInfo.pid, 'egg-schex', evtInfo);
            return;
          }
          const jobBase = {
            cron: job.cron,
            fun: job.fun,
            switch: false,
          };

          this.drv.stopJob(job.name, jobBase, 'Remote Stop');
          evtInfo.status = true;
          evtInfo.msg = 'receive stop command';
          this.agent.messenger.sendTo(evtInfo.pid, 'egg-schex', evtInfo);

        } break;
      default: break;
    }
  }

  /**
	 * run all job
	 */
  run() {
    for (const job in this.schedules) {
      if (this.schedules[job].switch === true) {
        runJob(this, this.schedules[job]);
      }
    }
  }

  /**
	 * Stop this module
	 */
  stop() {
    for (const job in this.schedules) {
      stopJob(this, this.schedules[job]);
    }

    this.drv.stop_monitor();
    this.logger.info('exit ...');
  }

  /**
	 * Update Job，if cron or fun has change,and the job is running,then restart job.
	 * - If job not run,only change the config.
	 * - If job not exist,while add new job,but can't run it ,you must manual run it( call runJob );
	 *
	 * @param  {String} name  job name
	 * @param  {Object} scCfg {"corn":<* * * * * * *>,"fun":"","switch":true|false}
	 */
  updateJob(name, scCfg) {
    addJob(this, name, scCfg);
  }


  removeSubJob(name) {
    return removeSubJob(this, name);
  }


  /**
	 * run job
	 * @param  {[type]} name job's name
	 */
  runJob(name) {
    const job = this.schedules[ name ];
    if (job === undefined) {
      this.logger.info(`[schex-ag] job [ ${name}] not exist;`);
    } else {
      runJob(this, job);
    }
  }

  /** stop job
	 *
	 * @param {String} name job's name
	 * @param {String} msg message
	 */
  stopJob(name, msg) {
    const job = this.schedules[ name ];
    if (job === undefined) {
      this.logger.info(`[schex-ag] job [ ${name}] not exist;`);
    } else {
      if (typeof (msg) === 'string') {
        job.msg = msg;
      }

      stopJob(this, job);
    }
  }

  checkSchedulesCfg(schedulesCfg) {
    const self = this;
    for (const sc in schedulesCfg) {
      const jobCfg = schedulesCfg[sc];
      const ret = addJob(self, sc, jobCfg);
      switch (ret) {
        case con.AddCode.OK:
          if (jobCfg.switch === true) {
            runJob(self, self.schedules[sc]);
          }
          break;
        case con.AddCode.Exception:
          break;
        case con.AddCode.Exist:
          {
            const thisJob = self.schedules[sc];
            if (jobCfg.switch === true) {
              if (thisJob.switch === false) {
                if (thisJob.status === false) {
                  runJob(self, thisJob);
                }
              } else {
                thisJob.restaring = true;
              }
            } else {
              if (thisJob.status === true) {
                stopJob(self, thisJob);
              }
            }

            thisJob.switch = jobCfg.switch;
          }
          break;
        default:break;
      }
    }
  }

  getConfig(jobname) {
    return this.drv.getConfig(jobname);
  }

  updateMsg(jobname, msg) {
    return this.drv.update_msg(jobname, msg);
  }

}

module.exports = SchexManagerAgent;

// ///////


function getJobFunPath(jobFun) {
  let pwd = path.resolve(jobFun);
  if (fs.existsSync(pwd) === true) {
    return pwd;
  }
  pwd = path.resolve('./node_modules/' + jobFun);
  if (fs.existsSync(pwd) === true) {
    return jobFun;
  }


  return '';
}

function runJob(self, job) {
  if (job.status === false) {
    if (job.parent === null || job.parent === undefined) {
      self.runAction(job, self.jobStep.INIT, {
        parent: null,
      });
    }
  }
}

function getNextRunTime(spec) {
  let val = 0;
  let nx = null;

  try {
    const inter = CornParser.parseExpression(spec);
    nx = inter.next();
    const curTime = Math.floor(Date.now() / 1000);
    const nxTime = Math.floor(nx.valueOf() / 1000);

    if (nxTime === curTime) {
      nx = inter.next();
    }
  } catch (err) {
    const type = typeof spec;
    if ((type === 'string') || (type === 'number')) {
      nx = new Date(spec);
    }
  }

  if (nx !== null) {
    val = Math.floor(nx.valueOf() / 1000);
  }

  return val;
}

function stopJob(self, job) {
  if (job.status === true) {
    self.logger.info(`[schex-ag] [ ${job.name} ] stoping ...`);

    for (const j in self.schedules) {
      const jobT = self.schedules[j];
      if (jobT.parent !== null && jobT.parent.name === job.name) {
        if (jobT.status === true) {
          if (jobT.job !== null) {
            jobT.job.cancel();
            jobT.hasInit = false;
            jobT.status = false;
            jobT.stopTime = Math.floor(Date.now() / 1000);
            self.logger.info(`[schex-ag] [ ${jobT.name} ] stoped`);
            self.drv.update_Job(con.STA.STOP, jobT);
          }
          stopJob(self, jobT);
        }
      }
    }

    self.runAction(job, con.JobStep.STOP);

    if (job.job !== null) {
      job.job.cancel();
      job.hasInit = false;
      job.status = false;
      job.stopTime = Math.floor(Date.now() / 1000);
      self.logger.info(`[schex-ag] [ ${job.name} ] stoped`);
      self.drv.update_Job(con.STA.STOP, job);
    }
  }
}


function addJob(self, name, scCfg) {
  if (self.schedules[ name ] === undefined || self.schedules[ name ] === null) {
    const jobTmp = { name,
      ctx: {}, // job 执行上下文，存储job逻辑需要的数据
      cron: scCfg.cron,
      fun: scCfg.fun,
      switch: scCfg.switch,
      status: false,
      ins: null, // 函数实例
      job: null, // jobID
      startTime: 0,
      stopTime: 0,
      latestRunTime: 0,
      msg: '',
      parent: null,
    };

    const pwd = getJobFunPath(scCfg.fun);
    if (pwd.length > 2) {
      self.schedules[name] = jobTmp;
      self.logger.info(`[schex-ag] add Job [ ${name} ]`);
      return con.AddCode.OK;
    }
    const msg = scCfg.fun + ' not exists!';
    jobTmp.msg = msg;
    self.drv.update_Job(con.STA.EXCEPTION, jobTmp);
    self.logger.info(`[schex-ag] add Job [ ${name} ] fun not exist`);
    return con.AddCode.Exception;

  }
  let hasChange = false;
  const thisJob = self.schedules[name];
  if (thisJob.cron !== scCfg.cron) {
    thisJob.cron = scCfg.cron;
    hasChange = true;
  }

  if (thisJob.fun !== scCfg.fun) {
    thisJob.fun = scCfg.fun;
    hasChange = true;
  }

  if (hasChange === true) {
    self.logger.info(`[schex-ag] Change Job [ ${name} ]`);
    stopJob(self, thisJob);
  }


  self.logger.info(`[schex-ag] add Job [ ${name} ] has exist`);
  return con.AddCode.Exist;
}

/** Add Sub Job,The child and parent to use the same function
 *
 * @param {SchexManagerAgent} self  SchexManagerAgent
 * @param {String} name sub job name
 * @param {Object} scCfg config
 */
function addSubJob(self, name, scCfg) {

  if (scCfg.parent === undefined) {
    self.logger.warn('[schex-ag] no parent info');
    return con.AddCode.Exception;
  }

  const jobParent = self.schedules[ scCfg.parent ];
  if (jobParent === undefined) {
    self.logger.warn('[schex-ag] not find parent info');
    return con.AddCode.Exception;
  }

  if (self.schedules[ name ] === undefined) {
    const jobTmp = { name,
      cron: scCfg.cron,
      fun: scCfg.fun,
      switch: scCfg.switch,
      status: false,
      ins: jobParent.ins, // 函数实例
      job: null, // jobID
      startTime: 0,
      stopTime: 0,
      latestRunTime: 0,
      msg: '',
      parent: jobParent,
    };

    self.schedules[name] = jobTmp;
    self.logger.info(`[schex-ag] add Sub Job [ ${name} ]`);
    return con.AddCode.OK;
  }
  let hasChange = false;
  const thisJob = self.schedules[name];
  if (thisJob.cron !== scCfg.cron) {
    thisJob.cron = scCfg.cron;
    hasChange = true;
  }

  // 记录任务当前状态
  if (hasChange === true) {
    self.logger.info(`[schex-ag] Change Sub Job [ ${name} ]`);
    stopJob(self, thisJob);
    if (thisJob.status === true) {
      runJob(self, thisJob);
    }
  }


  self.logger.info(`[schex-ag] add Sub Job [ ${name} ] has exist`);
  return con.AddCode.Exist;
}

function removeSubJob(self, name) {
  if (self.schedules[ name ] !== undefined) {

    stopJob(self, self.schedules[ name ]);
    const parJob = self.schedules[ name ].parent;

    if (parJob !== undefined && parJob !== null) {
      const schs = self.schedules;
      delete schs[name];
      self.drv.removeJob(name);
    }
  }
}

