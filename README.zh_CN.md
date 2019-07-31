# egg-schex

[![NPM version][npm-image]][npm-url]


[npm-image]: https://img.shields.io/npm/v/egg-schex.svg?style=flat-square
[npm-url]: https://npmjs.org/package/egg-schex
[sdb-schedule]: https://github.com/shudingbo/sdb-schedule#API
[sample]: https://github.com/shudingbo/egg-schex-sample.git

本插件用于为eggjs提供更加灵活的计划任务功能，功能封装自 [sdb-schedule][sdb-schedule]。
* 可以在脚本里控制计划任务的运行，停止；
* 支持子任务

** 详细参考 [sdb-schedule][sdb-schedule]**

## 依赖说明

### 依赖的 egg 版本

egg-schex 版本 | egg 1.x
--- | ---
1.x | 😁
0.x | ❌

### 依赖的插件

- ioredis

## 安装

```bash
$ npm i egg-schex --save
```

## 开启插件

```js
// config/plugin.js
exports.schex = {
  enable: true,
  package: 'egg-schex',
};
```
## 配置

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
## 使用场景
本插件实现了灵活的定时任务管理，可以在插件里控制定时任务的开关。
- 子计划任务功能， 可以代码创建 子计划；
- 本插件实现了灵活的定时任务管理，可以在插件里控制定时任务的开关,创建子任务
尽可能描述详细。


### 任务状态
- 初始化 （INIT）

- 运行 （RUN）

- 停止 （STOP），插件在停止后，其运行上下文会被重置；

### 运行时状态
#### 上下文
上下文 （ctx） 存储了任务运行时数据，用于确保每个worker进程运行时，状态一致。 子任务和父任务共用同一个上下文。


### 例子 [示例][sample]
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


## 详细配置

请到 [config/config.default.js](config/config.default.js) 查看详细配置项说明。

## 单元测试

<!-- 描述如何在单元测试中使用此插件，例如 schedule 如何触发。无则省略。-->

## 提问交流

请到 [egg issues](https://github.com/eggjs/egg/issues) 异步交流。

## License

[MIT](LICENSE)
