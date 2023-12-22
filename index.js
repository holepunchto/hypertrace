const objectState = new Map()
const traceFunctionSymbol = Symbol.for('hypertrace.traceFunction')

class Hypertrace {
  constructor (ctx, opts = { }) {
    if (!ctx) throw new Error('Context required, see hypertrace documentation')

    const { parent, props } = opts
    this.ctx = ctx
    this.className = ctx.constructor.name
    this.props = props || null
    this.enabled = true
    this.parentObject = !parent
      ? null
      : {
          className: parent.className,
          id: parent.objectId,
          props: { ...parent.props },
          ctx: parent.ctx
        }

    const currentObjectState = objectState.get(ctx.constructor) || { id: 0, stacktraceCache: new Map() }
    currentObjectState.id += 1
    this.objectId = currentObjectState.id
    objectState.set(ctx.constructor, currentObjectState)
  }

  setParent (parentTracer) {
    this.parentObject = !parentTracer
      ? null
      : {
          className: parentTracer.className,
          id: parentTracer.objectId,
          props: { ...parentTracer.props },
          ctx: parentTracer.ctx
        }
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

    const currentObjectState = objectState.get(this.ctx.constructor)
    let stack = cacheId && currentObjectState.stacktraceCache.get(cacheId)
    const hasCachedStacktrace = !!stack
    if (!hasCachedStacktrace) {
      const errorToGetContext = new Error()
      stack = errorToGetContext.stack
      currentObjectState.stacktraceCache.set(cacheId, stack)
    }

    const callLine = stack.split('\n')[2]
    const re = /.*at (.+) \((?:file:\/:\/)?(.+):(\d+):(\d+)\)/
    const [, functionName, filename, line, column] = callLine.match(re)

    const realFunctionName = functionName.split('.')[0] === this.className // Turn SomeModule.foobar => foobar
      ? functionName.substr(functionName.indexOf('.') + 1)
      : functionName

    const object = {
      className: this.className,
      id: this.objectId,
      props: this.props && { ...this.props },
      ctx: this.ctx
    }
    const caller = {
      functionName: realFunctionName,
      filename,
      line: Number(line),
      column: Number(column),
      props: props && { ...props }
    }

    traceFunction({
      cacheId: cacheId || null,
      object,
      parentObject: this.parentObject,
      caller
    })
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
