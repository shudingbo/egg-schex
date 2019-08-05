'use strict';

const fs = require('fs');
const path = require('path');
const con = require('./const.js');
const process = require('process');
const EventEmitter = require('events');

class SchexEmitter extends EventEmitter {}

/** 获取 Job 脚本路径
 * @param {String} jobFun 执行脚本路径
 */
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

/** schex Manafer for APP
 *
 */
class SchexManagerApp {
  /**
   * @class
   * @param {object} opt opt
   * @param {Application} app egg-js app
   */
  constructor(opt, app) {
    this.condef = con;

    this.jobStep = con.JobStep;
    this.app = app;
    this.logger = app.getLogger('schexLogger');
    this.jobs = {};
    this.logger.info('[schex-ap] start init schex worker ...');

    this.curOperaCtlMethod = null; // 当前正在处理的控制方法
    this.emitter = new SchexEmitter();
  }

  onJobEvt(evtInfo) {
    if (this.jobs[evtInfo.name] === undefined && evtInfo === this.jobStep.STOP) {
      return;
    }

    this.logger.debug(`[schex-ap] recv ${evtInfo.name} ${evtInfo.step}`, evtInfo.ctx);

    if (evtInfo.method !== undefined) {
      switch (evtInfo.method) {
        case con.Method.ctlSta:
        case con.Method.ctlAddJob:
        case con.Method.ctlDelJob:
        case con.Method.ctlUpdateJob:
        case con.Method.ctlStartJob:
        case con.Method.ctlStopJob:
          this.onEvtCtlMethod(evtInfo);
          break;
        default:
          this.onEvtMethod(evtInfo);
          break;
      }
      return;
    }

    // run with anonymous context
    if (this.jobs[evtInfo.name] === undefined) { // create instance
      const job = evtInfo;
      if (job.parent === null) {
        this.initJob(evtInfo);
      } else { // subjob Init,
        /* 1. get Parent Job Info
					 2. Init the subJob
				*/
        if (this.jobs[job.parent] === undefined) {
          this.sendMsg(job, con.JobStep.STOP, null, {
            pid: process.pid,
            method: con.Method.info,
          });
          return;
        }
        job.msg = 'Init OK';
        this.jobs[job.name ] = job; // 有可能是子任务初始化
      }
    }

    switch (evtInfo.step) {
      case this.jobStep.INIT:
        this.sendMsg(this.jobs[evtInfo.name], con.JobStep.INIT, null);
        break;
      case this.jobStep.RUN:
      case this.jobStep.STOP:
        this.onEvtRunStop(evtInfo);
        break;
      default: break;
    }
  }

  sendMsg(job, step, err, addInfo) {
    const info = {
      name: job.name,
      ctx: job.ctx,
      step,
      err,
      msg: (job.msg !== undefined) ? job.msg : '',
      addInfo: (addInfo !== undefined) ? addInfo : {},
    };

    if (info.addInfo.method !== undefined) {
      info.method = info.addInfo.method;
    }

    if (job.parent !== null) {
      if (this.jobs[job.parent] !== undefined) {
        info.ctx = this.jobs[ job.parent ].ctx;
      } else {
        info.ctx = {};
      }
    }
    this.app.messenger.sendToAgent('egg-schex', info);
  }

  initJob(evtInfo) {
    const job = evtInfo;
    if (job.parent === null) {
      const ctxTmp = Object.assign({}, evtInfo.ctx);
      const eggctx = this.app.createAnonymousContext({
        method: 'SCHEDULE',
        url: `/__schexsdb?path=${evtInfo.name}}`,
      });

      const pwd = getJobFunPath(job.fun);
      delete require.cache[pwd];
      const ins = require(pwd);
      const insT = new ins(eggctx, this, job);
      job.ins = this.app.toAsyncFunction(insT.onAct);
      job.insClass = insT;
      job.ins.call(job.insClass, job, con.JobStep.INIT);

      if (Object.keys(ctxTmp).length > 0) { // 在其它状态第一次运行
        job.ctx = ctxTmp;
      }

      job.msg = 'Init OK';

      this.jobs[job.name ] = job; // 有可能是子任务初始化
    }
  }


  onEvtMethod(evtInfo) {
    if (evtInfo.addInfo.pid !== process.pid) {
      return;
    }

    if (evtInfo.parent !== null) {
      const p = evtInfo.parent;
      const par = {
        name: p.name,
        fun: p.fun,
        parent: null,
        cfg: p.cfg,
        step: 1,
        ctx: evtInfo.ctx,
      };

      this.initJob(par);
    }

    if (evtInfo.addInfo.pid === process.pid) {
      const p = evtInfo;
      const par = {
        name: p.name,
        fun: p.fun,
        parent: evtInfo.parent.name,
        err: null,
        step: 1,
        ctx: evtInfo.ctx,
      };
      this.onJobEvt(par);
    }
  }


  onEvtCtlMethod(evtInfo) {
    this.curOperaCtlMethod = null;
    switch (evtInfo.method) {
      case con.Method.ctlSta:
        this.onEvtCtlSta(evtInfo);
        break;
      case con.Method.ctlAddJob:
      case con.Method.ctlDelJob:
      case con.Method.ctlUpdateJob:
      case con.Method.ctlStartJob:
      case con.Method.ctlStopJob:
        this.emitter.emit('evtRet', evtInfo);
        break;
      default: break;
    }
  }


  onEvtRunStop(evtInfo) {
    const job = this.jobs[ evtInfo.name ];
    let actJob = job;
    if (actJob.parent !== null && actJob.parent !== undefined) {
      actJob = this.jobs[ actJob.parent ];
    }

    actJob.ctx = evtInfo.ctx;

    (async () => {
      try {
        const msg = await actJob.ins.call(actJob.insClass, job, evtInfo.step);
        if (msg !== undefined) {
          job.msg = msg;
        }

        this.sendMsg(job, evtInfo.step, null);
        if (evtInfo.step === this.jobStep.STOP) { // 删除job;
          for (const p in this.jobs) {
            if (this.jobs[p] !== undefined && this.jobs[p].parent === evtInfo.name) {
              this.jobs[p] = undefined;
            }
          }

          this.jobs[evtInfo.name] = undefined;
        }
      } catch (e) {
        this.logger.warn(`[schex-ap] ${e.toString()}`);
        this.sendMsg(job, evtInfo.step, e.toString());
      }
    })();
  }

  /** 获取任务状态事件响应 */
  onEvtCtlSta(evtInfo) {
    if (evtInfo.status === true) {
      const dataO = {};

      const jobs = evtInfo.data.jobs;
      const stas = evtInfo.data.status;
      for (const it in jobs) {
        dataO[ it ] = JSON.parse(jobs[it]);
        dataO[it].name = it;
      }

      for (const it in stas) {
        const t = JSON.parse(stas[it]);

        if (t.latestHandleTime !== undefined) { t.latestHandleTime = new Date(t.latestHandleTime * 1000); }
        if (t.latestRunTime !== undefined) { t.latestRunTime = new Date(t.latestRunTime * 1000); }
        if (t.nextRunTime !== undefined) { t.nextRunTime = new Date(t.nextRunTime * 1000); }
        if (t.startTime !== undefined) { t.startTime = new Date(t.startTime * 1000); }
        if (t.stopTime !== undefined) { t.stopTime = new Date(t.stopTime * 1000); }

        let jobmsg = t.msg;
        if (jobmsg === undefined) {
          jobmsg = '';
        }

        t.msg = jobmsg;
        if (t.parent !== undefined) {
          if (dataO[t.parent] !== undefined) {
            if (dataO[t.parent].children === undefined) {
              dataO[t.parent].children = [];
            }

            dataO[t.parent].children.push({
              name: it,
              stat: t,
            });
          }
        } else {
          if (dataO[ it ] !== undefined) {
            dataO[it].stat = t;
          }
        }
      }

      const dataTmp = [];
      for (const it in dataO) {
        if (dataO[it].stat === undefined) {
          dataO[it].stat = { msg: '' };
        }

        dataTmp.push(dataO[it]);
      }
      dataTmp.sort((a, b) => {
        if (b.stat === undefined || a.stat === undefined) {
          return 0;
        }
        return b.stat.startTime - a.stat.startTime;
      });

      evtInfo.data = dataTmp;
      delete evtInfo.jobs;
      delete evtInfo.status;
    }

    // // 回传信息给上层
    this.emitter.emit('evtRet', evtInfo);
  }


  /** add Sub job
	 * @param {String} name job’s name
	 * @param {Object} scCfg job's config
	 * @param {String} scCfg.cron cron String OR Unix timestamp
	 * @param {Boolean} scCfg.switch job switch
	*/
  addSubJob(name, scCfg) {

    const job = this.jobs[ scCfg.parent ];
    scCfg.name = name;
    scCfg.method = this.condef.Method.add;
    this.sendMsg(job, this.jobStep.RUN, null, scCfg);
  }


  /** Stop Sub job
	 *
	 * @param {String} name job's name
	 * @param {String} msg message
	 */
  stopSubJob(name, msg) {
    const job = this.jobs[ name ];
    if (job === undefined) {
      this.logger.info(`[schex-ap]  job [ ${name}] not exist;`);
    } else {
      if (typeof (msg) === 'string') {
        job.msg = msg;
      }
      this.sendMsg(job, con.JobStep.STOP, null, {
        method: con.Method.stop,
      });
    }
  }


  updateMsg(jobname, msg) {
    return this.drv.update_msg(jobname, msg);
  }

  isHandleCtlMsg() {
    return (this.curOperaCtlMethod !== null);
  }

  /** 发送控制消息
   *
   * @param {Object} info 控制消息对象
   * @param {Number} info.method @see const.js Method
   * @param {String} info.name job's name, empty string('')就是所有job
   */
  async sendCtlMsg(info) {
    if (info.method === undefined || info.method < con.Method.ctlSta || info.method > con.Method.ctlStopJob) {
      return { status: false, msg: 'UnSupport control method!' };
    }

    if (info.method !== con.Method.ctlSta && info.name === undefined) {
      return { status: false, msg: 'Required jobName parame!' };
    }

    if (this.curOperaCtlMethod !== null) {
      return { status: false, msg: `Now is Handler job ${this.curOperaCtlMethod.jobName}` };
    }

    this.curOperaCtlMethod = info;
    info.pid = process.pid;
    this.app.messenger.sendToAgent('egg-schex', info);


    return new Promise((resolve, rejecte) => {
      this.emitter.on('evtRet', evtInfo => {
        resolve(evtInfo);
      });
    });
  }


  async addJob(jobname, base, cfg) {
    const evtInfo = {
      method: con.Method.ctlAddJob,
      name: jobname,
      base,
      cfg,
    };

    return this.sendCtlMsg(evtInfo);
  }

  async updateJob(jobname, base, cfg) {
    const evtInfo = {
      method: con.Method.ctlUpdateJob,
      name: jobname,
      base,
      cfg,
    };

    return this.sendCtlMsg(evtInfo);
  }

  /** Delete Job
   * @param {String} jobName job's name
   */
  async deleteJob(jobName) {
    const evtInfo = {
      method: con.Method.ctlDelJob,
      name: jobName,
    };

    return this.sendCtlMsg(evtInfo);
  }

  /** Get All job's status */
  async getJobStatus() {
    const evtInfo = {
      method: con.Method.ctlSta,
      name: '',
    };

    return this.sendCtlMsg(evtInfo);
  }

  /** Stop Job
   * @param {String} jobName job's name
   */
  async stopJob(jobName) {
    const evtInfo = {
      method: con.Method.ctlStopJob,
      name: jobName,
    };

    return this.sendCtlMsg(evtInfo);
  }

  /** Start Job
   * @param {String} jobName job's name
   */
  async startJob(jobName) {
    const evtInfo = {
      method: con.Method.ctlStartJob,
      name: jobName,
    };

    return this.sendCtlMsg(evtInfo);
  }


} // end class


module.exports = SchexManagerApp;

