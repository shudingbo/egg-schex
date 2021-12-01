'use strict';

class Message {
  constructor(app, ctx) {
    this.app = app;
    this.ctx = ctx;
  }

  static get isMsg() {
    return true;
  }
}

module.exports = Message;
