const test = require('brittle')
const Hypertrace = require('../')
const SomeModule = require('./SomeModule')

function teardown () {
  Hypertrace.clearTraceFunction()
}

test('Caller is set for trace function', t => {
  t.teardown(teardown)
  t.plan(4)

  Hypertrace.setTraceFunction(({ caller }) => {
    t.is(caller.functionName, 'foo')
    t.is(caller.filename, '/test/SomeModule.js')
    t.is(caller.line, 9)
    t.is(caller.column, 17)
  })

  const someModule = new SomeModule()
  someModule.foo()
})

test('Object is set for trace function', t => {
  t.teardown(teardown)
  t.plan(2)

  Hypertrace.setTraceFunction(({ object }) => {
    t.is(object.className, 'SomeModule')
    t.is(typeof object.objectId, 'number')
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

  Hypertrace.setTraceFunction(({ object }) => {
    if (!firstObjectId) {
      firstObjectId = object.objectId
    } else {
      t.is(object.objectId, firstObjectId)
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

  Hypertrace.setTraceFunction(({ object }) => {
    t.is(object.objectId, 1)
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

  Hypertrace.setTraceFunction(({ object }) => {
    if (!firstObjectId) {
      firstObjectId = object.objectId
    } else {
      t.is(object.objectId, firstObjectId + 1)
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

  Hypertrace.setTraceFunction(({ object }) => {
    objectIdFromTracing = object.objectId
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
      this.tracer = new Hypertrace(this, { customProperties: someProps })
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

test('Instantiating hypertrace without a parent hypertrace, sets parentObject', t => {
  t.teardown(teardown)
  t.plan(1)

  Hypertrace.setTraceFunction(({ parentObject }) => {
    t.absent(parentObject)
  })

  class SomeClass {
    constructor () {
      this.tracer = new Hypertrace(this)
    }

    foo () {
      this.tracer.trace()
    }
  }
  const obj = new SomeClass()

  obj.foo()
})

test('Instantiating hypertrace with a parent hypertrace, sets parentObject', t => {
  t.teardown(teardown)
  t.plan(5)

  Hypertrace.setTraceFunction(({ object, parentObject, caller }) => {
    t.is(object.className, 'SomeChild')
    t.is(object.objectId, 1)
    t.is(parentObject.className, 'SomeParent')
    t.is(parentObject.objectId, 1)
    t.is(caller.functionName, 'foo')
  })

  class SomeParent {
    constructor () {
      this.tracer = new Hypertrace(this)
    }

    createChild () {
      const child = new SomeChild(this)
      return child
    }
  }

  class SomeChild {
    constructor (parent) {
      this.tracer = new Hypertrace(this, {
        parent: parent.tracer
      })
    }

    foo () {
      this.tracer.trace()
    }
  }

  const core = new SomeParent()
  const child = core.createChild()

  child.foo()
})
