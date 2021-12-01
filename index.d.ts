/// <reference types="node" />

import {
  Application,
  Context,
  Agent,
} from 'egg';

import { EggLogger, EggLoggers, LoggerLevel as EggLoggerLevel, EggLoggersOptions, EggLoggerOptions, EggContextLogger } from 'egg-logger';

type JobStep = {

}

type JobBase = {
  /** Cron String */
  cron : String 

  /** job's script */
  fun  : String

  /** Job's switch */
  switch: Boolean
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

export class SchexManagerApp {
  /** Egg Application */
  app: Application;
  logger: EggLogger;


  /** 是否有正在处理的控制消息 */
  isHandleCtlMsg() : Boolean

  /** start Job */
  startJob( jobName:String): Object

  /** stop Job */
  stopJob( jobName:String): Object

  /** delete Job */
  deleteJob( jobName:String): Object

  /** get all Job status */
  getJobStatus( ): Object


  /** add Job */
  addJob( jobName:String, base:JobBase, cfg:Object ): Object

  /** Update Job Info*/
  updateJob( jobName:String, base:JobBase, cfg:Object ): Object
}

export type SubJobOpt = {
  /** Job cron */
  cron: string

  /** switch */
  switch : Boolean
};

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

  /** addSubJob */
  addSubJob( name:String, opt:SubJobOpt ): void

  /** stopSubJob */
  stopSubJob( name:String, msg:String ): void
}


interface EggSchexOption {
  /** redis server host */
  host: String;

  /** redis server port */
  port: Number;

  /** redis server password */
  password: String;

  /** redis server db index */
  db: Number;

  /** redis schex key pre */
  keyPre: String;

  /** schex check job status interval( ms ) */
  checkInterval: Number;

  /** schex init job config path */
  jobInitCfg: String;
}

interface EggSchexOptions {
  client: EggSchexOption;
}


declare module 'egg' {
  interface Application {
    schex: SchexManagerApp;
  }

  interface EggAppConfig {
    schex: EggSchexOptions;
  }
}

declare module "egg-schex" {
  abstract class SCMsg<T = object> {
    ctx: Context;
    app: Application;

    abstract run(data: T, channel): Promise<any>;
  }
}
