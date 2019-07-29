'use strict';

const SchexJob = require('egg-schex').SchexJob;

const init_ctx = {
  test: 0,
  subJob: {
    cnt: 0,
  },
};
const subJobName = 'sub_t';
class UpdateCache extends SchexJob {

  constructor(ctx, sc, job) {
    super(ctx, sc, job);

    this.cnt = 1;
  }

  onActInit() {
    this._job.ctx = Object.assign({}, init_ctx);
  }

  onActRun() {
    const { ctx } = this._job;
    const { eggctx: ectx } = this;

    ctx.test += 1;
    console.log('----------', this._job.name, Date.now(), ctx.test);
    console.log(ectx.helper.dateFormat());
    // console.log(this.ctx, this.app);
    this._job.msg = `${ctx.test} `;

    if (ctx.test === 2 || ctx.test === 17) {
      this.addSubJob(subJobName, {
        cron: '*/2 * * * * *',
        switch: 1,
      });
    } else if (ctx.test === 15 || ctx.test === 19) {
      this.stopJob(subJobName, `Stop ${subJobName}`);
    }
  }

  onActStop() {
    this._job.ctx = init_ctx;
  }

  onActPause() {
    console.log('onActPause1');
  }

  onActSubRun(job) {
    // console.log('onActSubRun-1:', job.name);

    this._job.ctx.subJob.cnt++;
    console.log('--- ctx=', this._job.ctx);
    job.msg = `${this._job.ctx.subJob.cnt}`;
  }

  onActSubStop(job) {
    // console.log('onActSubStop-1:', job.name);
    this._job.ctx.subJob.cnt = 0;
  }
}

module.exports = UpdateCache;
