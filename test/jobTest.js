'use strict';
const mssql = require('mssql');

module.exports = function(sc, job, runStep) {
  if (runStep === 1) {
    startTa(sc, job);
  }
};


function startTa(sc, job) {
  const { app } = sc;

  (async () => {
    try {
      const sTime = Date.now();
      const qu = new mssql.Request(app.mssql);
      await qu.execute('TaxReport');
      await qu.execute('DateReport');

      const dTime = Date.now() - sTime;
      sc.updateMsg(job.name, 'success:DateReport Success!' + dTime);
    } catch (err) {
      sc.updateMsg(job.name, err.toString());
    }
  })();
}

