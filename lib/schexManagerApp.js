'use strict';

const fs = require('fs');
const path = require('path');
const con = require('./const.js');
const process = require('process');


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
    this.curOperaCtlCb = null; // 当前 控制方法 的回调
  }

  onJobEvt(evtInfo) {
    if (this.jobs[evtInfo.name] === undefined && evtInfo === this.jobStep.STOP) {
      return;
    }

    this.logger.debug(`[schex-ap] recv ${evtInfo.name} ${evtInfo.step}`, evtInfo.ctx);

    if (evtInfo.method !== undefined) {
      this.onEvtMethod(evtInfo);
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


  /** Stop job
	 *
	 * @param {String} name job's name
	 * @param {String} msg message
	 */
  stopJob(name, msg) {
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

  /** 发送控制消息
   *
   * @param {Object} info 控制消息对象
   * @param {Number} info.method @see const.js Method
   * @param {String} info.jobName job's name, empty string('')就是所有job
   * @param {Function} cb 回调函数
   */
  sendCtlMsg(info, cb) {
    if (info.method === undefined || info.method < con.Method.ctlSta || info.method > con.Method.ctlUpdateJob) {
      return { status: false, msg: 'UnSupport control method!' };
    }

    if (info.method !== con.Method.ctlSta && info.jobName === undefined) {
      return { status: false, msg: 'Required jobName parame!' };
    }

    if (this.curOperaCtlMethod !== null) {
      return { status: false, msg: `Now is Handler job ${this.curOperaCtlMethod.jobName}` };
    }

    this.curOperaCtlMethod = info;
    this.curOperaCtlCb = cb;

    this.app.messenger.sendToAgent('egg-schex', info);
  }
} // end class


module.exports = SchexManagerApp;

