'use strict';
const sc = require('./lib/schedulex');

module.exports = app => {
  if (app.config.schex.app) sc(app);
};
