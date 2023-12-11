import path from 'path'

let traceFunction

const objectIds = new Map()

export default class Tracer {
  constructor(ctx) {
    if (!ctx) return

    this.className = ctx.constructor.name
    const currentObjectId = objectIds.get(ctx.constructor) || 0
    this.objectId = currentObjectId + 1
    objectIds.set(ctx.constructor, this.objectId)
  }

  static setTraceFunction(f) {
    traceFunction = f
  }

  static clearTraceFunction() {
    traceFunction = undefined
  }

  trace(data) {
    if (!traceFunction) return

    const errorToGetContext = new Error()
    const callLine = errorToGetContext.stack.split('\n')[2]
    const [_, functionName, absolutePath, line, column] = callLine.match(/.*at (.+) \(file\:\/\/(.+)\:(\d+)\:(\d+)\)/)
    // To simplify output, show relative path of executing file
    const sharedPath = longestSharedPath(absolutePath, process.cwd())
    const filename = `${path.sep}${absolutePath.split(sharedPath)[1]}`
    const caller = {
      functionName,
      filename,
      line: Number(line),
      column: Number(column)
    }
    if (this.className) caller.className = this.className
    if (this.objectId) caller.objectId = this.objectId
    traceFunction({
      data: { ...data },
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
