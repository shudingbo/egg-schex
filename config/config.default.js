'use strict';

module.exports = () => {
  const config = {};

  config.customLogger = {
    schexLogger: {
      consoleLevel: 'INFO',
      file: 'egg-schex.log',
    },
  };

  config.schex = {
    // custom additional directory, full path
    directory: [],
  };

  return config;
};


