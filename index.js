const objectState = new Map()
const objectInstanceCount = new WeakMap()
const traceFunctionSymbol = Symbol.for('hypertrace.traceFunction')
const memoryFunctionSymbol = Symbol.for('hypertrace.memoryFunction')
const gcRegistrySymbol = Symbol.for('hypertrace.gcRegistry')

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

    const currentInstanceCount = objectInstanceCount.get(ctx.constructor) || 0
    objectInstanceCount.set(ctx.constructor, currentInstanceCount + 1)

    const memoryFunction = global[memoryFunctionSymbol]
    const gcRegistry = global[gcRegistrySymbol]
    const shouldHandleMemory = memoryFunction && gcRegistry
    if (!shouldHandleMemory) return

    gcRegistry.register(this, {
      // Note: There cannot be any references to `this`, or `parent` here because they might've
      // been gc'ed, and then the FinalizationRegistry chooses not to fire the event
      constructor: ctx.constructor,
      object: {
        className: this.className,
        id: this.objectId,
        props: this.props
      },
      parentObject: !parent
        ? null
        : {
            className: parent.className,
            id: parent.objectId,
            props: parent.props
          }
    })
    memoryFunction({
      type: 'alloc',
      instanceCount: currentInstanceCount + 1,
      object: {
        className: this.className,
        id: this.objectId,
        props: this.props
      },
      parentObject: !parent
        ? null
        : {
            className: parent.className,
            id: parent.objectId,
            props: parent.props
          }
    })
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

    let [id, props] = args
    const hasTraceIdInArgs = typeof id === 'string'
    if (!hasTraceIdInArgs) {
      props = id
      id = null
    }

    const currentObjectState = objectState.get(this.ctx.constructor)
    let stack = id && currentObjectState.stacktraceCache.get(id)
    const hasCachedStacktrace = !!stack
    if (!hasCachedStacktrace) {
      const errorToGetContext = new Error()
      stack = errorToGetContext.stack
      currentObjectState.stacktraceCache.set(id, stack)
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
      id: id || null,
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

  setParent () { /* noop */ }
}

const noTracing = new NoTracingClass()

function createGcRegistry () {
  return new FinalizationRegistry(({ constructor, object, parentObject }) => {
    const currentInstanceCount = objectInstanceCount.get(constructor) || 0
    objectInstanceCount.set(constructor, currentInstanceCount - 1)

    const memoryFunction = global[memoryFunctionSymbol]
    const shouldCallMmemoryFunction = !!memoryFunction
    if (shouldCallMmemoryFunction) {
      memoryFunction({
        type: 'free',
        instanceCount: currentInstanceCount - 1,
        object,
        parentObject
      })
    }
  })
}

module.exports = {
  setTraceFunction: fn => {
    global[traceFunctionSymbol] = fn
  },
  clearTraceFunction: () => {
    global[traceFunctionSymbol] = undefined
  },
  setMemoryFunction: fn => {
    global[memoryFunctionSymbol] = fn
    global[gcRegistrySymbol] = global[gcRegistrySymbol] || createGcRegistry()
  },
  clearMemoryFunction: () => {
    global[memoryFunctionSymbol] = undefined
    global[gcRegistrySymbol] = undefined
  },
  createTracer: (ctx, opts) => {
    // If either the trace or memory function is not set, then the returned class cannot trace.
    // This is done for speed.
    const isTracing = global[traceFunctionSymbol] || global[memoryFunctionSymbol]
    if (!isTracing) return noTracing
    return new Hypertrace(ctx, opts)
  }
}
