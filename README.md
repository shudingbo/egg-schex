# egg-schex

[![NPM version][npm-image]][npm-url]


[npm-image]: https://img.shields.io/npm/v/egg-schex.svg?style=flat-square
[npm-url]: https://npmjs.org/package/egg-schex
[sdb-schedule]: https://github.com/shudingbo/sdb-schedule#API
[sample]: https://github.com/shudingbo/egg-schex-sample.git
[sdb-schedule-ui]: https://github.com/shudingbo/sdb-schedule-ui
[download]: https://github.com/shudingbo/sdb-public/blob/master/sdb-schedule-ui/sdb-schedule-ui.7z
[idMain]: https://github.com/shudingbo/sdb-public/blob/master/sdb-schedule-ui/main.jpg  "Main"
[idSet]: https://github.com/shudingbo/sdb-public/blob/master/sdb-schedule-ui/setting.jpg  "Setting"

![Setting][idSet]

本插件用于为eggjs提供更加灵活的计划任务功能，使用 redis 存储相关数据（数据存放在 **keyPre** 定义的redis键里）。
* 可以在脚本里控制计划任务的运行，停止；
* 支持子任务创建，停止
* 

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

## APP(UI)
Now we implement an app [sdb-schedule-ui],using admin schedules( only support redis drv ),you can [download] it.
- Base Electron
- Sample https://github.com/shudingbo/egg-schex-sample.git

### 任务数据存储
可以通过 UI 对任务进行配置
任务数据存储在redis里，包含下列4个键，均为 hash。
- **< keyPre >**:jobs 存放任务的基本信息，包含 cron执行计划，执行名称，执行脚本
- **< keyPre >**:cfg  存放任务的附带配置信息
- **< keyPre >**:updateTime 存放任务基本信息和附带信息的最后修改时间，schex 根据此时间戳判断任务是否变化，任务配置变化后会停止并重启任务
- **< keyPre >**:status 任务的执行状态


#### **< keyPre >**:jobs
key,任务名字；value，任务基本信息
``` javascript
{
  "cron": "*/60 * * * * *",
  "fun": "./sc/autoadjust.js",
  "switch": false
}
```
* cron, cron 字符串
* fun,  任务执行脚本
* switch, 任务开关

#### **< keyPre >**:cfg
- key,任务名字；
- value，josn 格式任务配置，配置会在任务初始化时，传给job，
``` javascript
{
}
```

#### **< keyPre >**:updateTime
- key,任务名字；
- value，Unix 时间戳

#### **< keyPre >**:status
任务运行后会自动更新。
- key,任务名字；
- value，josn 格式,任务执行状态
``` javascript
{
  "status": true,
  "latestHandleType": 1,
  "latestHandleTime": 1564557950,
  "startTime": 1564557927,
  "stopTime": 0,
  "latestRunTime": 1564557950,
  "nextRunTime": null,
  "msg": "3 "
}
```
* status, 任务是否运行
* startTime, Unix 时间戳，任务启动时间
* stopTime,  Unix 时间戳，任务停止时间
* latestRunTime, Unix 时间戳，最近任务执行时间
* nextRunTime,  Unix 时间戳，下次任务执行时间
* msg, 任务消息


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
