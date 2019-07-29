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
    this.app = sc.app;
    this.sc = sc;
    this._job = job;
  }

  async onAct( job, step ){
    switch (step) {
      case this.sc.jobStep.INIT:
        return this.onActInit();
      case this.sc.jobStep.RUN:
        {
            if( job.parent !== null && job.parent !== undefined ){ // sub Job
              return this.onActSubRun( job );
            }
            else{
              return this.onActRun();
            }
        }
      case this.sc.jobStep.STOP:
        {
          if( job.parent !== null && job.parent !== undefined ){ // sub Job
            return this.onActSubStop( job );
          }
          else{
            return this.onActStop();
          }
        }
      default:
        break;
    }
  }

  onActInit(){
    this._job.ctx = {};
  }

  async onActRun(){ return '';}

  async onActStop(){ return '';}
  
  async onActPause(){ return '';}

  async onActSubRun(){ return '';}

  async onActSubStop(){ return '';}

  /** add subjob 添加子任务 
   * @param {String} name jobName
   * @param {object} opt job param 
   *           { 
   *              cron: corn string or unix timestamp
   *              switch: true,
   *           }
  */
  addSubJob( name, opt ){
    opt.parent = this._job.name;
    this.sc.addSubJob( name, opt);
  }

  stopJob( name, msg ){
    this.sc.stopJob( name, msg );
  }

}

module.exports = BaseJobClass;