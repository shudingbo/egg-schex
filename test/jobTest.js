'use strict';

const SchexJob = require('egg-schex').SchexJob;

const init_ctx = {
  test: 0,
};

// simple module //////////
// module.exports = function (eggctx, sc, job, runStep) {
//   switch (runStep) {
//   case sc.jobStep.INIT:
//     job.ctx = Object.assign({}, init_ctx);
//     return init_ctx;
//   case sc.jobStep.RUN:
//     return startTa(eggctx, sc, job);
//   case sc.jobStep.STOP:
//     job.ctx = init_ctx;
//     break;
//   default:
//     break;
//   }
// };


// function startTa (ctx, sc, job) {
//   // const { app } = sc;
//   (async () => {

//     job.ctx.test += 2;
//     console.log('----------', job.name, Date.now(), job.ctx.test);
//     job.msg = `${job.ctx.test} `;
//     console.log(ctx.helper.dateFormat());
//   })();
// }

// mode class /////////////////////////////////////

class UpdateCache extends SchexJob {
  // subscribe 是真正定时任务执行时被运行的函数

  onActInit() {
    console.log('onActInit1');
    this._job.ctx = Object.assign({}, init_ctx);
  }

  onActRun() {
    console.log('onActRun1');
    const { ctx } = this._job;
    const { eggctx: ectx } = this;

    ctx.test += 1;
    console.log('----------', this._job.name, Date.now(), ctx.test);
    console.log(ectx.helper.dateFormat());
    this._job.msg = `${ctx.test} `;

  }

  onActStop() {
    console.log('onActStop1');
    this._job.ctx = init_ctx;
  }

  onActPause() {
    console.log('onActPause1');
  }
}

module.exports = UpdateCache;
