# egg-schex

[![NPM version][npm-image]][npm-url]


[npm-image]: https://img.shields.io/npm/v/egg-schex.svg?style=flat-square
[npm-url]: https://npmjs.org/package/egg-schex
[sdb-schedule]: https://github.com/shudingbo/sdb-schedule#API
[sample]: https://github.com/shudingbo/egg-schex-sample.git


This plug-in is used for eggjs to provide more flexible planning task function, function package from [sdb-schedule][sdb-schedule].
* Can control the running and stopping of scheduled tasks in the script
* Support subtasks

** A detailed reference [sdb-schedule][sdb-schedule]**

## Install

```bash
$ npm i egg-schex --save
```

## Usage

```js
// {app_root}/config/plugin.js
exports.schex = {
  enable: true,
  package: 'egg-schex',
};
```

## Configuration

```js
// {app_root}/config/config.default.js
exports.schex = {
    client: {
      port: 6379,
      host: '192.168.2.10',
      password: null,
      keyPre: 'sdb:schedule',      // redis key preName
      checkInterval: 5000,
    }
};

```

see [config/config.default.js](config/config.default.js) for more detail.

### sample  [egg-schex-sample][sample]
https://github.com/shudingbo/egg-schex-sample.git

目录结构
```
  - app
  - config
  - sc
    - jobTest.js    ()
```
./test/jobTest.js
``` js
'use strict';

const SchexJob = require('egg-schex').SchexJob;

const init_ctx = {
  test: 0, // 任务属性
  subJob: {
    cnt: 0, // 子任务属性
  },
};
const subJobName = 'sub_t'; // 子任务名称


class UpdateCache extends SchexJob {

  constructor(ctx, sc, job) {
    super(ctx, sc, job);
    this.cnt = 1;
  }

  // 任务初始化函数，在这里设置初始化数据
  onActInit() {
    this._job.ctx = Object.assign({}, init_ctx);
  }

  /** 任务处理函数 */
  async onActRun() {
    const { ctx } = this._job; // 获取任务的 ctx
    const { ctx: ectx, app } = this; // 获取 egg 的 ctx 和 app

    ctx.test += 1;
    console.log('----------', this._job.name, Date.now(), ctx.test);
    console.log(ectx.helper.dateFormat());
    // console.log(this.ctx, this.app);
    this._job.msg = `${ctx.test} `;

    if (ctx.test === 2 || ctx.test === 17) { // 启动子任务
      this.addSubJob(subJobName, {
        cron: '*/2 * * * * *',
        switch: 1,
      });
    } else if (ctx.test === 15 || ctx.test === 19) { // 关闭子任务
      this.stopJob(subJobName, `Stop ${subJobName}`);
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

module.exports = UpdateCache;


```



<!-- example here -->

## Questions & Suggestions

Please open an issue [here](https://github.com/eggjs/egg/issues).

## License

[MIT](LICENSE)
