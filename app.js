'use strict';
const scA = require('./lib/schexApp');

module.exports = app => {
  // register schedule event
  app.messenger.on('egg-schex', (...args) => {
    app.schex.onJobEvt(...args);
  });

  app.messenger.once('egg-ready', () => {
    // start schedule after worker ready
    scA(app);
  });
};
