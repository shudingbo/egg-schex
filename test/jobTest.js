'use strict';

const SchexJob = require('../index').SchexJob;

const init_ctx = {
  test: 0, // 任务属性
  subJob: {
    cnt: 0, // 子任务属性
  },
};

class SchexJobSample extends SchexJob {

  constructor(ctx, sc, job) {
    super(ctx, sc, job);

    this.subJobName = job.name + '-sub_t'; // 子任务名称
  }

  // 任务初始化函数，在这里设置初始化数据
  onActInit() {
    this._job.ctx = Object.assign({}, init_ctx);
  }

  /** 任务处理函数 */
  async onActRun() {
    const { ctx, cfg } = this._job; // 获取任务的 ctx
    const { ctx: ectx, app } = this; // 获取 egg 的 ctx 和 app
    this.logger.info('test');
    console.log(cfg);
    ctx.test += 1;
    console.log('----------', this._job.name, Date.now(), ctx.test);
    console.log(ectx.helper.dateFormat());
    // console.log(this.ctx, this.app);
    this._job.msg = `${ctx.test} `;

    if (ctx.test === 2 || ctx.test === 17) { // 启动子任务
      this.addSubJob(this.subJobName, {
        cron: '*/2 * * * * *',
        switch: 1,
      });
    } else if (ctx.test === 15 || ctx.test === 19) { // 关闭子任务
      this.stopSubJob(this.subJobName, `Stop ${this.subJobName}`);
    }
  }

  async onActStop() {
    this._job.ctx = init_ctx;
  }

  /** 子任务处理
   * @param {Object} job 子任务结构
  */
  async onActSubRun(job) {
    // console.log('onActSubRun-1:', job.name);

    this._job.ctx.subJob.cnt++;
    console.log('--- ctx=', this._job.ctx);
    job.msg = `${this._job.ctx.subJob.cnt}`;
  }

  /** 子任务停止
   * @param {Object} job 子任务结构
   */
  async onActSubStop(job) {
    // console.log('onActSubStop-1:', job.name);
    this._job.ctx.subJob.cnt = 0;
  }
}

module.exports = SchexJobSample;
