'use strict';

const Job = require('./lib/job_base');
const Msg = require('./lib/msg_base');
/**
 * Start egg application with single process mode
 * @since 1.0.0
 */
module.exports = {
  SchexJob: Job,
  SCMsg: Msg,
};

