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

export class SchexManagerAgent {
  /** Egg Application */
  agent: Agent
  logger: EggLogger
}

type CtlMethod = {
  ctlSta: Number, // 获取所有job状态
  ctlAddJob: 4, // 添加Job
  ctlDelJob: 5, // 删除Job
  ctlUpdateJob: 6, // 更新JOB或配置(包括开关)
}

type CtlRet = {
  /** Job name */
  status: Boolean

  /** Message */
  msg : String
};



declare function cbCtlMsgRet(cb?:(res:Object)=>void): void

export class SchexManagerApp {
  /** Egg Application */
  app: Application
  logger: EggLogger
  sendCtlMsg( info:CtlMsg,  cb:cbCtlMsgRet ): ctlRet
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

