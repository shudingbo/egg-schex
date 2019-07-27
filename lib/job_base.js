'use strict';

/**
 * BaseContextClass is a base class that can be extended,
 * it's instantiated in context level,
 * {@link Helper}, {@link Service} is extending it.
 */
class BaseJobClass
{
  get logger() {
    return this.sc.logger;
  }

  constructor(ctx, sc,job) {
    this.eggctx = ctx;
    this.sc = sc;
    this._job = job;
  }

  onAct( job, step ){
    switch (step) {
      case this.sc.jobStep.INIT:
        return this.onActInit();
      case this.sc.jobStep.RUN:
        return this.onActRun();
      case this.sc.jobStep.STOP:
        return this.onActStop();
      default:
        break;
    }
  }

  onActInit(){
    this._job.ctx = {};
  }

  onActRun(){
  }

  onActStop(){
  }
  
  onActPause(){
  }
}

module.exports = BaseJobClass;