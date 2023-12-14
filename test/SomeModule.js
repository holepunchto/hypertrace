const Hypertrace = require('../')

module.exports = class SomeModule {
  constructor (customProperties) {
    this.tracer = new Hypertrace(this, customProperties)
  }

  foo (opts) {
    this.tracer.trace(opts)
  }

  getTracingObjectId () {
    this.tracer.trace()
    return this.tracer.getObjectId()
  }
}
