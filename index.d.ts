/// <reference types="node" />

import {
  Application,
  Context,
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

export class SchexManagerApp {
  /** Egg Application */
  app: Application
  logger: EggLogger
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

