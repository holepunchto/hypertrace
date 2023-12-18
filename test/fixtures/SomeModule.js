const { createTracer } = require('../../')

module.exports = class SomeModule {
  constructor (customProperties) {
    this.tracer = createTracer(this, customProperties)
  }

  foo (opts) {
    this.tracer.trace(opts)
  }

  getTracingObjectId () {
    this.tracer.trace()
    return this.tracer.getObjectId()
  }
}
