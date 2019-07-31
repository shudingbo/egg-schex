/// <reference types="node" />

import {
  Application,
  Context,
} from 'egg';

export class SchexManagerApp {
  app: typeof Application
}

export class BaseJobClass {
  ctx: typeof Context
  app: typeof Application
  sc : SchexManagerApp
}

