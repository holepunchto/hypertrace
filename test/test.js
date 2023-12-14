const test = require('brittle')
const Hypertrace = require('../')
const SomeModule = require('./SomeModule.js')
const axios = require('axios')

function teardown () {
  Hypertrace.clearTraceFunction()
  Hypertrace.clearPrometheusMonitoringTarget()
}

test('Caller is set for trace function', t => {
  t.teardown(teardown)
  t.plan(6)

  Hypertrace.setTraceFunction(({ caller }) => {
    t.is(caller.functionName, 'foo')
    t.is(caller.className, 'SomeModule')
    t.is(typeof caller.objectId, 'number')
    t.is(caller.filename, '/test/SomeModule.js')
    t.is(caller.line, 9)
    t.is(caller.column, 17)
  })

  const someModule = new SomeModule()
  someModule.foo()
})

test('Args are passed to trace function', t => {
  t.teardown(teardown)
  t.plan(1)

  Hypertrace.setTraceFunction(({ args }) => {
    t.alike(args, someArgs)
  })

  const someModule = new SomeModule()
  const someArgs = {
    someProperty: Buffer.from('some value')
  }
  someModule.foo(someArgs)
})

test('Context needs to be given', t => {
  t.teardown(teardown)
  t.plan(1)

  t.exception(() => new Hypertrace(/* no context here */))
})

test('ObjectId remains the same in an objects lifetime', t => {
  t.teardown(teardown)
  t.plan(2)

  Hypertrace.setTraceFunction(({ caller }) => {
    if (!firstObjectId) {
      firstObjectId = caller.objectId
    } else {
      t.is(caller.objectId, firstObjectId)
    }
  })

  const someModule = new SomeModule()
  let firstObjectId

  someModule.foo()
  someModule.foo()
  someModule.foo()
})

test('ObjectId for a class starts at 1', t => {
  t.teardown(teardown)
  t.plan(1)

  Hypertrace.setTraceFunction(({ caller }) => {
    t.is(caller.objectId, 1)
  })

  class SomeClass {
    constructor () {
      this.tracer = new Hypertrace(this)
    }

    fun () {
      this.tracer.trace()
    }
  }
  const obj = new SomeClass()

  obj.fun()
})

test('ObjectId increases by one for same class', t => {
  t.teardown(teardown)
  t.plan(1)

  Hypertrace.setTraceFunction(({ caller }) => {
    if (!firstObjectId) {
      firstObjectId = caller.objectId
    } else {
      t.is(caller.objectId, firstObjectId + 1)
    }
  })

  let firstObjectId
  const someModule1 = new SomeModule()
  const someModule2 = new SomeModule()

  someModule1.foo()
  someModule2.foo()
})

test('Object is able to read its own objectId', t => {
  t.teardown(teardown)
  t.plan(1)

  Hypertrace.setTraceFunction(({ caller }) => {
    objectIdFromTracing = caller.objectId
  })

  const someModule = new SomeModule()
  let objectIdFromTracing
  const objectIdFromObject = someModule.getTracingObjectId() // The function returns this.tracing.getObjectId()

  t.is(objectIdFromObject, objectIdFromTracing)
})

test('Custom properties are always added to events in trace function', t => {
  t.teardown(teardown)
  t.plan(1)

  Hypertrace.setTraceFunction(({ customProperties }) => {
    t.alike(customProperties, someProps)
  })

  class SomeClass {
    constructor () {
      this.tracer = new Hypertrace(this, someProps)
    }

    fun () {
      this.tracer.trace()
    }
  }

  const someProps = {
    someProp: 'someValue'
  }
  const obj = new SomeClass()

  obj.fun()
})

test('Not setting custom properties is also supported', t => {
  t.teardown(teardown)
  t.plan(1)

  Hypertrace.setTraceFunction(({ customProperties }) => {
    t.absent(customProperties)
  })

  const someModule = new SomeModule()

  someModule.foo()
})

test('setPrometheusMonitoringTarget creates http server with /metrics endpoint', async t => {
  t.teardown(teardown)
  t.plan(1)

  Hypertrace.setPrometheusMonitoringTarget({ port: 4343 })
  const { data } = await axios.get('http://localhost:4343/metrics')
  t.ok(data.includes('# HELP trace_counter Counts how many times a function has been traced'))
})

test('Clearning Prometheus monitoring target stops http server', async t => {
  t.teardown(teardown)
  t.plan(2)

  Hypertrace.setPrometheusMonitoringTarget({ port: 4343 })
  const { status } = await axios.get('http://localhost:4343/metrics')
  t.is(status, 200)

  Hypertrace.clearPrometheusMonitoringTarget()
  t.exception(async () => {
    await axios.get('http://localhost:4343/metrics', { timeout: 1000 })
  })
})

test('Collecting defaults for Prometheus adds metrics', async t => {
  t.teardown(teardown)
  t.plan(1)

  Hypertrace.setPrometheusMonitoringTarget({ port: 4343, collectDefaults: true })
  const { data } = await axios.get('http://localhost:4343/metrics')
  t.ok(data.includes('process_cpu_user_seconds_total'))
})

test('Not collecting defaults for Prometheus does not add metrics', async t => {
  t.teardown(teardown)
  t.plan(2)

  Hypertrace.setPrometheusMonitoringTarget({ port: 4343, collectDefaults: false })
  const { data } = await axios.get('http://localhost:4343/metrics')
  t.absent(data.includes('process_cpu_user_seconds_total'))
  t.is(data.split('\n').length, 3)
})

test('Labels set for trace_counter for Prometheus', async t => {
  t.teardown(teardown)
  t.plan(5)

  Hypertrace.setPrometheusMonitoringTarget({ port: 4343, collectDefaults: false })

  const someModule = new SomeModule()
  someModule.foo()

  const { data } = await axios.get('http://localhost:4343/metrics')
  const [, typeStr, counterStr] = data.split('\n')
  t.is(typeStr, '# TYPE trace_counter counter')
  t.ok(counterStr.includes('caller_classname="SomeModule"'))
  t.ok(counterStr.includes('caller_object_id="'))
  t.ok(counterStr.includes('caller_functionname="foo"'))
  t.ok(counterStr.includes('caller_filename="/test/SomeModule.js"'))
})

test('Counter set for trace_counter for Prometheus', async t => {
  t.teardown(teardown)
  t.plan(2)

  Hypertrace.setPrometheusMonitoringTarget({ port: 4343, collectDefaults: false })

  const someModule = new SomeModule()

  someModule.foo()

  const { data: data1 } = await axios.get('http://localhost:4343/metrics')
  const [, , counterStr1] = data1.split('\n')
  t.is(counterStr1[counterStr1.length - 1], '1')

  someModule.foo()

  const { data: data2 } = await axios.get('http://localhost:4343/metrics')
  const [, , counterStr2] = data2.split('\n')
  t.is(counterStr2[counterStr2.length - 1], '2')
})

test('Collect custom properties for Prometheus', async t => {
  t.teardown(teardown)
  t.plan(1)

  Hypertrace.setPrometheusMonitoringTarget({
    port: 4343,
    allowedCustomProperties: ['bar'],
    collectDefaults: false
  })

  const customProperties = {
    bar: 'bleh'
  }
  const someModule = new SomeModule(customProperties)
  someModule.foo()

  const { data } = await axios.get('http://localhost:4343/metrics')
  const [, , counterStr] = data.split('\n')
  t.ok(counterStr.includes('bar="bleh"'))
})

test('Setting non-allowed custom properties for Prometheus means they are not captured', async t => {
  t.teardown(teardown)
  t.plan(2)

  Hypertrace.setPrometheusMonitoringTarget({
    port: 4343,
    allowedCustomProperties: ['someAllowedProperty'],
    collectDefaults: false
  })

  const customProperties = {
    someAllowedProperty: 'foo',
    someNonallowedProperty: 'bar'
  }
  const someModule = new SomeModule(customProperties)
  someModule.foo()

  const { data } = await axios.get('http://localhost:4343/metrics')
  const [, , counterStr] = data.split('\n')
  t.ok(counterStr.includes('someAllowedProperty'))
  t.absent(counterStr.includes('someNonallowedProperty'))
})

test('Collecting custom properties with illegal label characters, changes the char to underscore', async t => {
  t.teardown(teardown)
  t.plan(2)

  Hypertrace.setPrometheusMonitoringTarget({
    port: 4343,
    allowedCustomProperties: ['foo-bar'],
    collectDefaults: false
  })

  const customProperties = {
    'foo-bar': 'foo'
  }
  const someModule = new SomeModule(customProperties)
  someModule.foo()

  const { data } = await axios.get('http://localhost:4343/metrics')
  const [, , counterStr] = data.split('\n')
  t.ok(counterStr.includes('foo_bar'))
  t.absent(counterStr.includes('foo-bar'))
})
