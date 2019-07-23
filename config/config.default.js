'use strict';

/**
 * egg-schedulex default config
 * @member Config#scheduleX
 * @property {String} SOME_KEY - some description
 */
exports.schex = {
  default: {
    host: '192.168.2.10',
    port: 6379,
    keyPre: 'sdb:schedule',
    checkInterval: 5000,
  },
  app: true,
  agent: false,
};
