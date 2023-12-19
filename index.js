const objectIds = new Map()
const traceFunctionSymbol = Symbol.for('hypertrace.traceFunction')

class Hypertrace {
  constructor (ctx, opts = { }) {
    if (!ctx) throw new Error('Context required, see hypertrace documentation')

    const { parent, props } = opts
    this.ctx = ctx
    this.className = ctx.constructor.name
    this.props = props || null
    this.parentObject = !parent
      ? null
      : {
          className: parent.getClassName(),
          id: parent.getObjectId(),
          props: parent.getProps()
        }

    const currentObjectId = objectIds.get(ctx.constructor) || 0
    this.objectId = currentObjectId + 1
    objectIds.set(ctx.constructor, this.objectId)
  }

  getObjectId () {
    return this.objectId
  }

  getClassName () {
    return this.className
  }

  getProps () {
    return this.props
  }

  trace (props) {
    const traceFunction = global[traceFunctionSymbol]
    const shouldTrace = traceFunction
    if (!shouldTrace) return

    const errorToGetContext = new Error()
    const callLine = errorToGetContext.stack.split('\n')[2]
    const re = /.*at (.+) \((?:file:\/:\/)?(.+):(\d+):(\d+)\)/
    const [, functionName, filename, line, column] = callLine.match(re)

    const realFunctionName = functionName.split('.')[0] === this.className // Turn SomeModule.foobar => foobar
      ? functionName.substr(functionName.indexOf('.') + 1)
      : functionName

    const object = {
      className: this.className,
      id: this.objectId,
      props: this.props
    }
    const caller = {
      functionName: realFunctionName,
      filename,
      line: Number(line),
      column: Number(column),
      props
    }

    traceFunction({
      object,
      parentObject: this.parentObject,
      caller
    })
  }
}

class NoTracingClass {
  trace () { /* noop */ }
  getObjectId () { /* noop */ }
  getClassName () { /* noop */ }
  getProps () { /* noop */ }
}

const noTracing = new NoTracingClass()

module.exports = {
  setTraceFunction: fn => {
    global[traceFunctionSymbol] = fn
  },
  clearTraceFunction: () => {
    global[traceFunctionSymbol] = undefined
  },
  createTracer: (ctx, opts) => {
    // If the trace function is not set, then the returned class cannot trace.
    // This is done for speed.
    const isTracing = !!global[traceFunctionSymbol]
    if (!isTracing) return noTracing
    return new Hypertrace(ctx, opts)
  }
}
