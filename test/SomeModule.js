import Tracing from '../index.js'

export default class SomeModule {
  constructor() {
    this.tracing = new Tracing(this)
  }

  foo(opts) {
    this.tracing.trace(opts)
  }
}
