const path = require('path')

const objectIds = new Map()
const traceFunctionSymbol = Symbol.for('hypertrace.traceFunction')

class Hypertrace {
  constructor (ctx, opts = { }) {
    if (!ctx) throw new Error('Context required, see hypertrace documentation')

    const { parent, props } = opts
    this.className = ctx.constructor.name
    this.props = props
    this.parent = parent && {
      className: parent.getClassName(),
      id: parent.getObjectId(),
      props: parent.getProps()
    }

    const currentObjectId = objectIds.get(ctx.constructor) || 0
    this.objectId = currentObjectId + 1
    objectIds.set(ctx.constructor, this.objectId)
  }

  static setTraceFunction (fn) {
    global[traceFunctionSymbol] = fn
  }

  static clearTraceFunction () {
    global[traceFunctionSymbol] = undefined
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
    const [, functionName, absolutePath, line, column] = callLine.match(re)

    const sharedPath = longestSharedPath(absolutePath, process.cwd())
    const filename = `${absolutePath.split(sharedPath)[1]}` // To simplify output, show relative path of executing file
    const realFilename = filename[0] === path.sep
      ? filename
      : `${path.sep}${filename}`

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
      filename: realFilename,
      line: Number(line),
      column: Number(column),
      props
    }

    traceFunction({
      object,
      parentObject: this.parent,
      caller
    })
  }
}

// To avoid oversharing a path
function longestSharedPath (pathA, pathB) {
  let sharedPath = ''

  for (let length = 0; length < pathA.length + 1; length++) {
    const substringA = pathA.substr(0, length)
    const substringB = pathB.substr(0, length)
    const isEqual = substringA === substringB
    if (!isEqual) break
    sharedPath = substringA
  }

  return sharedPath
}

module.exports = Hypertrace
