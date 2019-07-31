'use strict';

/**
 * BaseJobClass is a base class that implement schex Job,
 * it's instantiated in context level,
 * {@link Helper}, {@link Service} is extending it.
 *
 */
class BaseJobClass {
  get logger() {
    return this.sc.logger;
  }

  /**
   * @class
   * @param {Context} ctx egg-js context
   * @param {SchexManagerApp} sc schex app
   * @param {Object} job job refrence
   */
  constructor(ctx, sc, job) {

    /**
     * @member {Context} BaseContextClass#ctx
    */
    this.ctx = ctx;

    /**
     * @member {Application} BaseContextClass#app
     */
    this.app = sc.app;

    /**
     * @instance {SchexManagerApp}
     */
    this.sc = sc;
    this._job = job;
  }

  /** schex evt emit
   *
   * @param {object} job job Object
   * @param {number} step @see const.js JobStep
   */
  async onAct(job, step) {
    switch (step) {
      case this.sc.jobStep.INIT:
        return this.onActInit();
      case this.sc.jobStep.RUN:
      {
        if (job.parent !== null && job.parent !== undefined) { // sub Job
          return this.onActSubRun(job);
        }

        return this.onActRun();
      }
      case this.sc.jobStep.STOP:
      {
        if (job.parent !== null && job.parent !== undefined) { // sub Job
          return this.onActSubStop(job);
        }

        return this.onActStop();

      }
      default:
        break;
    }
  }

  onActInit() {
    this._job.ctx = {};
  }

  async onActRun() { return ''; }

  async onActStop() { return ''; }

  async onActPause() { return ''; }

  async onActSubRun() { return ''; }

  async onActSubStop() { return ''; }

  /** add subjob 添加子任务
   * @param {String} name jobName
   * @param {Object} opt job param
   * @param {String} opt.cron cron String OR Unix timestamp
   * @param {Boolean} opt.switch job switch
  */
  addSubJob(name, opt) {
    opt.parent = this._job.name;
    this.sc.addSubJob(name, opt);
  }

  /** Stop job
   *
   * @param {String} name job's name
   * @param {String} msg message
   */
  stopJob(name, msg) {
    this.sc.stopJob(name, msg);
  }

}

module.exports = BaseJobClass;
