'use strict';

const scA = require('./lib/schexAgent');

module.exports = agent => {
  
  agent.messenger.on('egg-schex', (...args) => {
    agent.schex.onJobEvt(...args);
  });

  agent.messenger.once('egg-ready', () => {
    // start schedule after worker ready
    scA( agent );
  });

};
