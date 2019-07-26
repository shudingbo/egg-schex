'use strict';
const scA = require('./lib/schexApp');

module.exports = app => {
  // register schedule event
  app.messenger.on('egg-schex', (...args) => {
    // console.log('app | ', info);
    // setTimeout(()=>{
    //   let info1 = {method:'send',job:'testJob',msg:'12345'};
    //   app.messenger.sendToAgent('egg-schex', info1);
    // },2000);

    app.schex.onJobEvt(...args);
  });

  app.messenger.once('egg-ready', () => {
    // start schedule after worker ready
    scA(app);
  });
};
