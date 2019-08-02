'use strict';

module.exports = {
  STA: {
    RUN: 1, // 运行
    START: 2,
    STOP: 3,
    EXCEPTION: 4, // exception
  },
  AddCode: {
    OK: 1, // add OK
    Exist: 2, // job exist
    Exception: 3, // add Exception
  },
  JobStep: {
    INIT: 0, // 初始化
    RUN: 1, // 运行
    STOP: 2, // 停止
  },
  Method: {
    add: 0, // 添加 job
    stop: 1, // 停止 job
    info: 2, // 获取jobinfo
    ctlSta: 3, // 获取所有job状态
    ctlAddJob: 4, // 添加Job
    ctlDelJob: 5, // 删除Job
    ctlUpdateJob: 6, // 更新JOB或配置(包括开关)

  },
};
