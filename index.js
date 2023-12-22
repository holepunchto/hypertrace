const objectIds = new Map()
const traceFunctionSymbol = Symbol.for('hypertrace.traceFunction')

class Hypertrace {
  constructor (ctx, opts = { }) {
    if (!ctx) throw new Error('Context required, see hypertrace documentation')

    const { parent, props } = opts
    this._cachedTracesArgs = new Map()
    this.ctx = ctx
    this.className = ctx.constructor.name
    this.props = props || null
    this.enabled = true
    this.parentObject = !parent
      ? null
      : {
          className: parent.className,
          id: parent.objectId,
          props: parent.props,
          ctx: parent.ctx
        }

    const currentObjectId = objectIds.get(ctx.constructor) || 0
    this.objectId = currentObjectId + 1
    objectIds.set(ctx.constructor, this.objectId)
  }

  trace (...args) {
    const traceFunction = global[traceFunctionSymbol]
    const shouldTrace = traceFunction
    if (!shouldTrace) return

    let [cacheId, props] = args
    const hasTraceIdInArgs = typeof cacheId === 'string'
    if (!hasTraceIdInArgs) {
      props = cacheId
      cacheId = null
    }

    const cachedTraceArgs = cacheId && this._cachedTracesArgs.get(cacheId)
    const shouldReturnCachedTraceArgs = !!cachedTraceArgs
    if (shouldReturnCachedTraceArgs) {
      cachedTraceArgs.caller.props = props
      traceFunction(cachedTraceArgs)
      return
    }

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
      props: this.props,
      ctx: this.ctx
    }
    const caller = {
      functionName: realFunctionName,
      filename,
      line: Number(line),
      column: Number(column),
      props
    }

    const traceArgs = {
      object,
      parentObject: this.parentObject,
      caller
    }

    if (cacheId) {
      this._cachedTracesArgs.set(cacheId, traceArgs)
    }

    traceFunction(traceArgs)
  }
}

class NoTracingClass {
  constructor () {
    this.enabled = false
    this.ctx = null
    this.className = null
    this.props = null
    this.objectId = null
  }

  trace () { /* noop */ }
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
