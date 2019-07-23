'use strict';

const mock = require('egg-mock');

describe('test/schedulex.test.js', () => {
  let app;
  before(() => {
    app = mock.app({
      baseDir: 'apps/schedulex-test',
    });
    return app.ready();
  });

  after(() => app.close());
  afterEach(mock.restore);

  it('should GET /', () => {
    return app.httpRequest()
      .get('/')
      .expect('hi, scheduleX')
      .expect(200);
  });
});
