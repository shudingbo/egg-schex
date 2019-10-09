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
* 通过UI创建，管理任务 **详细参考 [sdb-schedule][sdb-schedule]**


## 依赖说明
### 依赖的 egg 版本

egg-schex 版本 | egg 1.x
--- | ---
1.x | 😁

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
      db: 0,
      keyPre: 'sdb:schedule',      // redis key preName
      checkInterval: 5000,
      jobInitCfg: 'schex.json',    // 可选，初始化任务配置，在每次启动时将任务设置到 redis
    }
};

// {app_root}/config/schex.json
{
	"testSC":{
		"base":{
			"cron":"*/5 * * * * *",
			"fun":"./sc/testSC.js",
			"switch":true				
		},
		"cfg":{
			"rUrl":"http://test.com"
		}
	}
}
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

``` js
// ./test/jobTest.js
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


```
## 详细配置

请到 [config/config.default.js](config/config.default.js) 查看详细配置项说明。


## API
### Schex plugin API
  egg Service / controller 可以通过接口函数创建，管理job。 通过 this.app.schex.<函数名> 调用。

#### getJobStatus  获取所有任务的执行状态
```
getJobStatus(); 
```

#### addJob  增加任务
```
addJob( 'testAddJob',
    {
      cron: '*/5 * * * * *',
      fun: './sc/testAddJob.js',
      switch: false,
    },
    {
      path: 'this is path from cfg',
    }
  );
```

#### updateJob 更新任务配置
```
updateJob('testAddJob',
  {
    cron: '*/5 * * * * *',
    fun: './sc/testAddJob.js',
    switch: true,
  },
  {
    path: 'this is path from cfg 12',
  }
);

```

#### deleteJob 删除指定名称的任务
```
this.app.schex.('jobName');
```
#### startJob  启动指定名称的任务
```
updateJob('jobName');
```

#### stopJob 停止指定名称的任务
```
this.app.schex.('jobName');
```

### Job API
  任务 API 参见，例子 https://github.com/shudingbo/egg-schex-sample.git


## 更改记录

### 0.0.9
 1. 增加一系列接口函数， 其它 egg Service / controller 可以通过接口函数创建，管理job
 ```
   this.app.schex.getJobStatus();   // 获取所有任务的执行状态   
   this.app.schex.addJob(           // 增加任务
          'testAddJob',
          {
            cron: '*/5 * * * * *',
            fun: './sc/testAddJob.js',
            switch: false,
          },
          {
            path: 'this is path from cfg',
          }
        );
   
   /// 更新任务配置
   this.app.schex.updateJob(
          'testAddJob',
          {
            cron: '*/5 * * * * *',
            fun: './sc/testAddJob.js',
            switch: true,
          },
          {
            path: 'this is path from cfg 12',
          }
        );

   /// 删除指定名称的任务
   this.app.schex.stopJob('jobName');
  
   /// 启动指定名称的任务
   this.app.schex.startJob('jobName');

   /// 停止指定名称的任务
   this.app.schex.stopJob('jobName');
 ```

### 0.0.7
  1. 增加初始化任务配置，通过 配置 {app_root}/config/config.default.js 的 jobInitCfg字段
  ```
  // {app_root}/config/config.default.js
    exports.schex = {
        client: {
          port: 6379,
          host: '192.168.2.10',
          db: 0,
          keyPre: 'sdb:schedule',      // redis key preName
          checkInterval: 5000,
          jobInitCfg: 'schex.json',    // 新增 可选，初始化任务配置，在每次启动时将任务设置到 redis
        }
    };
  ```

### 0.0.6
 1. 增加 job 编写时的代码自动提示； 

### 0.0.5
 1. 实现子任务功能

### 0.0.4
 1. 实现基本任务功能

## 提问交流

请到 [egg-schex issues](https://github.com/shudingbo/egg-schex/issues) 异步交流。

## License

[MIT](LICENSE)
