const path = require('path')
const http = require('http')
const Prometheus = require('prom-client')

const VALID_PROMETHEUS_LABEL_CHARACTERS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_'

const objectIds = new Map()
const traceFunctionSymbol = Symbol.for('hypertrace.traceFunction')
const traceCounterSymbol = Symbol.for('hypertrace.traceCounter')
const allowedCustomPropertiesSymbol = Symbol.for('hypetrace.allowedCustomProperties')

class Hypertrace {
  constructor (ctx, customProperties) {
    if (!ctx) throw new Error('Context required, see hypertrace documentation')

    this.className = ctx.constructor.name
    this.customProperties = customProperties

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

  static setPrometheusMonitoringTarget ({ port, allowedCustomProperties = [], collectDefaults = true }) {
    const register = new Prometheus.Registry()

    global[allowedCustomPropertiesSymbol] = allowedCustomProperties
    const cleanedAllowedCustomProperties = allowedCustomProperties?.map(name => strToValidPrometheusLabel(name))
    const labelNames = [
      'caller_classname', 'caller_object_id', 'caller_functionname', 'caller_filename'
    ].concat(cleanedAllowedCustomProperties)

    const traceCounter = new Prometheus.Counter({
      name: 'trace_counter',
      help: 'Counts how many times a function has been traced',
      labelNames
    })
    register.registerMetric(traceCounter)

    if (collectDefaults) {
      Prometheus.collectDefaultMetrics({ register })
    }

    const server = http.createServer(async (req, res) => {
      const isMetricsEndpoint = req.url === '/metrics'
      if (!isMetricsEndpoint) return res.end()

      res.setHeader('Content-Type', register.contentType)
      const metrics = await register.metrics()
      res.end(metrics)
    })
    server.listen(port)

    global[traceCounterSymbol] = {
      traceCounter,
      server,
      register
    }
  }

  static clearPrometheusMonitoringTarget () {
    if (global[traceCounterSymbol]) {
      global[traceCounterSymbol].server.close()
      Prometheus.register.clear()
    }

    global[traceCounterSymbol] = undefined
  }

  trace (args) {
    const traceFunction = global[traceFunctionSymbol]
    const traceCounter = global[traceCounterSymbol]?.traceCounter
    const allowedCustomProperties = global[allowedCustomPropertiesSymbol]
    const shouldTrace = traceFunction || traceCounter
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

    const caller = {
      className: this.className,
      objectId: this.objectId,
      functionName: realFunctionName,
      filename: realFilename,
      line: Number(line),
      column: Number(column)
    }

    if (traceFunction) {
      traceFunction({
        args: { ...args },
        caller,
        customProperties: this.customProperties
      })
    }

    if (traceCounter) {
      // Not adding line/column to this
      const labels = {
        caller_classname: this.className,
        caller_object_id: this.objectId,
        caller_functionname: realFunctionName,
        caller_filename: realFilename
      }
      allowedCustomProperties?.forEach(name => {
        const value = this.customProperties[name]
        if (value !== undefined) {
          const cleanedName = strToValidPrometheusLabel(name)
          labels[cleanedName] = value
        }
      })
      traceCounter.inc(labels)
    }
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

function strToValidPrometheusLabel (str) {
  return str
    .split('')
    .map(c => VALID_PROMETHEUS_LABEL_CHARACTERS.includes(c) ? c : '_')
    .join('')
}

module.exports = Hypertrace
