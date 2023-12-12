const Tracing = require('../')

module.exports = class SomeModule {
  constructor() {
    this.tracing = new Tracing(this)
  }

  foo(opts) {
    this.tracing.trace(opts)
  }

  getTracingObjectId() {
    this.tracing.trace()
    return this.tracing.getObjectId()
  }
}
