# egg-schex

[![NPM version][npm-image]][npm-url]


[npm-image]: https://img.shields.io/npm/v/egg-schex.svg?style=flat-square
[npm-url]: https://npmjs.org/package/egg-schex
[sdb-schedule]: https://github.com/shudingbo/sdb-schedule#API

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
- （未实现）子计划任务功能， 可以代码创建 子计划；

- 本插件实现了灵活的定时任务管理，可以在插件里控制定时任务的开关
尽可能描述详细。
- How: 描述这个插件是怎样使用的，具体的示例代码，甚至提供一个完整的示例，并给出链接。

- 

### 任务状态
- 初始化 （INIT）

- 运行 （RUN）

- 停止 （STOP），插件在停止后，其运行上下文会被重置；

### 运行时状态
#### 上下文
上下文 （ctx） 存储了任务运行时数据，用于确保每个worker进程运行时，状态一致。 子任务和父任务共用同一个上下文。


## 详细配置

请到 [config/config.default.js](config/config.default.js) 查看详细配置项说明。

## 单元测试

<!-- 描述如何在单元测试中使用此插件，例如 schedule 如何触发。无则省略。-->

## 提问交流

请到 [egg issues](https://github.com/eggjs/egg/issues) 异步交流。

## License

[MIT](LICENSE)
