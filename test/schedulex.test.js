'use strict';

const mm = require('egg-mock');
const path = require('path');
const fs = require('fs');
const assert = require('assert');
const ioredis = require('ioredis');
const { sleep } = require('mz-modules');

describe('test/schedulex.test.js', () => {
  let app;
  const g_redis = { ins: null };
  g_redis.ins = new ioredis({
    host: '192.168.2.10',
    port: 6379,
  });

  before(() => {
    // app = mm.app();
    app = mm.cluster({ baseDir: 'all', workers: 2 });
    // 等待 app 启动成功，才能执行测试用例
    return app.ready();
  });


  afterEach(() => app.close());

  describe('schedule type all', () => {
    it('should support interval and cron', async () => {
      await sleep(5000);
    });
  });

});

/* eslint-disable-next-line no-unused-vars */
function getCoreLogContent(name) {
  const logPath = path.join(__dirname, 'fixtures', name, 'logs', name, 'egg-web.log');
  return fs.readFileSync(logPath, 'utf8');
}

function getLogContent(name) {
  const logPath = path.join(__dirname, 'fixtures', name, 'logs', name, `${name}-web.log`);
  return fs.readFileSync(logPath, 'utf8');
}

/* eslint-disable-next-line no-unused-vars */
function getErrorLogContent(name) {
  const logPath = path.join(__dirname, 'fixtures', name, 'logs', name, 'common-error.log');
  return fs.readFileSync(logPath, 'utf8');
}

/* eslint-disable-next-line no-unused-vars */
function getAgentLogContent(name) {
  const logPath = path.join(__dirname, 'fixtures', name, 'logs', name, 'egg-agent.log');
  return fs.readFileSync(logPath, 'utf8');
}

/* eslint-disable-next-line no-unused-vars */
function getScheduleLogContent(name) {
  const logPath = path.join(__dirname, 'fixtures', name, 'logs', name, 'egg-schedule.log');
  return fs.readFileSync(logPath, 'utf8');
}

function contains(content, match) {
  return content.split('\n').filter(line => line.indexOf(match) >= 0).length;
}
