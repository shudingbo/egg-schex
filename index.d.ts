/// <reference types="node" />

import {
  Application,
  Context,
  Agent,
} from 'egg';

import { EggLogger, EggLoggers, LoggerLevel as EggLoggerLevel, EggLoggersOptions, EggLoggerOptions, EggContextLogger } from 'egg-logger';

type JobStep = {

}


type Job = {

  /** Job's name */
  name : String

  /** job's script */
  fun  : String

  /** Job's parent job name */
  parent : null | String

  /** schex job config */
  cfg: Object

  /** Job run Step */
  step: Number
  
  /** schex job run context */
  ctx : Object;
}

export interface RedisDrv {
  /** Egg Application */
  agent: Agent
  logger: EggLogger
  getJobs() : Object
  startJob( jobName:String,  jobBase:Object, msg:String ): void
  stopJob( jobCfg:Object ): void
  addJob( jobCfg:Object ): void
}

export class SchexManagerAgent {
  /** Egg Application */
  agent: Agent
  logger: EggLogger
  drv: RedisDrv
}

// type CtlMethod = {
//   ctlSta: Number, // 获取所有job状态
//   ctlAddJob: 4, // 添加Job
//   ctlDelJob: 5, // 删除Job
//   ctlUpdateJob: 6, // 更新JOB或配置(包括开关)
// }

export type CtlRet = {
  /** Job name */
  status: Boolean

  /** Message */
  msg : String
};

export type CtlMsg = {
  /** method name */
  method: Number

  /** Job name */
  jobName : String
};

declare function cbCtlMsgRet(cb:(res:Object)=>void): void

export class SchexManagerApp {
  /** Egg Application */
  app: Application
  logger: EggLogger
  /** 发送控制消息 */
  sendCtlMsg( info:CtlMsg,  cb:(res:Object)=>void ): CtlRet
  
  /** 是否有正在处理的控制消息 */
  isHandleCtlMsg() : Boolean
}

export class SchexJob {
  /** egg ctx instance */
  ctx:  Context

  /** egg app instance */
  app:  Application
  sc :  SchexManagerApp

  /** Job Data */
  _job:  Job

  /** egg logger instance */
  logger: EggLogger
}

