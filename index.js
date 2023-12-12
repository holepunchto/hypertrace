const path = require('path')

const objectIds = new Map()

class Tracing {
  constructor(ctx) {
    if (!ctx) throw new Error('Context required, see @holepunchto/tracing documentation')
    this.className = ctx.constructor.name
    const currentObjectId = objectIds.get(ctx.constructor) || 0
    this.objectId = currentObjectId + 1
    objectIds.set(ctx.constructor, this.objectId)
  }

  static setTraceFunction(f) {
    global[Symbol.for('holepunch-tracing')] = f
  }

  static clearTraceFunction() {
    global[Symbol.for('holepunch-tracing')] = undefined
  }

  getObjectId() {
    return this.objectId
  }

  trace(args) {
    const traceFunction = global[Symbol.for('holepunch-tracing')]
    if (!traceFunction) return

    const errorToGetContext = new Error()
    const callLine = errorToGetContext.stack.split('\n')[2]
    const re = /.*at (.+) \((?:file\:\/:\/)?(.+)\:(\d+)\:(\d+)\)/
    const [_, functionName, absolutePath, line, column] = callLine.match(re)
    const sharedPath = longestSharedPath(absolutePath, process.cwd())
    const filename = `${absolutePath.split(sharedPath)[1]}` // To simplify output, show relative path of executing file
    const caller = {
      functionName,
      filename: filename[0] === path.sep ? filename : `${path.sep}${filename}`,
      line: Number(line),
      column: Number(column)
    }
    if (this.className) caller.className = this.className
    if (this.objectId) caller.objectId = this.objectId
    traceFunction({
      args: { ...args },
      caller
    })
  }
}

// To avoid oversharing a path
function longestSharedPath(pathA, pathB) {
  let sharedPath = ''

  for (let length = 0; length < pathA.length + 1; length++) {
    const substring = pathA.substr(0, length)
    const isEqual = substring === pathB.substr(0, length)
    if (!isEqual) break
    sharedPath = substring
  }

  return sharedPath
}

module.exports = Tracing
