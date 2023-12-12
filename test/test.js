const test = require('brittle')
const Tracing = require('../')
const SomeModule = require('./SomeModule.js')

function teardown() {
  Tracing.clearTraceFunction()
}

test('Caller is set', t => {
  t.teardown(teardown)
  t.plan(6)

  const someModule = new SomeModule()

  Tracing.setTraceFunction(({ caller }) => {
    t.is(caller.functionName, 'SomeModule.foo')
    t.is(caller.className, 'SomeModule')
    t.is(typeof caller.objectId, 'number')
    t.is(caller.filename, '/test/SomeModule.js')
    t.is(caller.line, 9)
    t.is(caller.column, 18)
  })

  someModule.foo()
})

test('Args are passed', t => {
  t.teardown(teardown)
  t.plan(1)

  const someModule = new SomeModule()
  const someArgs = {
    someProperty: Buffer.from('some value')
  }

  Tracing.setTraceFunction(({ args }) => {
    t.is(args.someProperty, someArgs.someProperty)
  })

  someModule.foo(someArgs)
})

test('ObjectId remains the same in an objects lifetime', t => {
  t.teardown(teardown)
  t.plan(2)

  const someModule = new SomeModule()

  let firstObjectId
  Tracing.setTraceFunction(({ caller }) => {
    if (!firstObjectId) {
      firstObjectId = caller.objectId
    } else {
      t.is(caller.objectId, firstObjectId)
    }
  })

  someModule.foo()
  someModule.foo()
  someModule.foo()
})

test('ObjectId for a class starts at 1', t => {
  t.teardown(teardown)
  t.plan(1)

  class SomeClass {
    constructor() {
      this.tracing = new Tracing(this)
    }

    fun() {
      this.tracing.trace()
    }
  }

  const obj = new SomeClass()

  Tracing.setTraceFunction(({ caller }) => {
    t.is(caller.objectId, 1)
  })

  obj.fun()
})

test('ObjectId increases by one for same class', t => {
  t.teardown(teardown)
  t.plan(1)

  const someModule1 = new SomeModule()
  const someModule2 = new SomeModule()

  let firstObjectId
  Tracing.setTraceFunction(({ caller }) => {
    if (!firstObjectId) {
      firstObjectId = caller.objectId
    } else {
      t.is(caller.objectId, firstObjectId + 1)
    }
  })

  someModule1.foo()
  someModule2.foo()
})

test('Object is able to read its own objectId', t => {
  t.teardown(teardown)
  t.plan(1)

  const someModule = new SomeModule()

  let objectIdFromTracing
  Tracing.setTraceFunction(({ caller }) => {
    objectIdFromTracing = caller.objectId
  })

  const objectIdFromObject = someModule.getTracingObjectId() // The function returns this.tracing.getObjectId()
  t.is(objectIdFromObject, objectIdFromTracing)
})
