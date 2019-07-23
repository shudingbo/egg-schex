# egg-schex

[![NPM version][npm-image]][npm-url]


[npm-image]: https://img.shields.io/npm/v/egg-schex.svg?style=flat-square
[npm-url]: https://npmjs.org/package/egg-schex
[sdb-schedule]: https://github.com/shudingbo/sdb-schedule#API


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
exports.scheduleX = {
  enable: true,
  package: 'egg-schex',
};
```

## Configuration

```js
// {app_root}/config/config.default.js
// if not have redis instanse
exports.schex = {
    client: {
      port: 6379,
      host: '192.168.2.10',
      password: null,
      keyPre: 'sdb:schedule',      // redis key preName
      checkInterval: 5000,
    }
};

// if has redis instance
exports.schex = {
    client: {
      keyPre: 'sdb:schedule',
      checkInterval: 5000,
      redisInstanseName: 'redis',   // The redis instance Name app.[redis]
    }
};

```

see [config/config.default.js](config/config.default.js) for more detail.

## API
See [Schex API][sdb-schedule]


<!-- example here -->

## Questions & Suggestions

Please open an issue [here](https://github.com/eggjs/egg/issues).

## License

[MIT](LICENSE)
