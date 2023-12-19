const test = require('brittle')
const { setTraceFunction, clearTraceFunction, createTracer } = require('../')
const SomeModule = require('./fixtures/SomeModule')

function teardown () {
  clearTraceFunction()
}

test('Caller is set for trace function', t => {
  t.teardown(teardown)
  t.plan(4)

  setTraceFunction(({ caller }) => {
    t.is(caller.functionName, 'foo')
    t.ok(caller.filename.endsWith('/test/fixtures/SomeModule.js'))
    t.is(caller.line, 9)
    t.is(caller.column, 17)
  })

  const someModule = new SomeModule()
  someModule.foo()
})

test('Props are passed as caller.props', t => {
  t.teardown(teardown)
  t.plan(1)

  setTraceFunction(({ caller }) => {
    t.alike(caller.props, someProps)
  })

  const someModule = new SomeModule()
  const someProps = {
    someProperty: Buffer.from('some value')
  }
  someModule.foo(someProps)
})

test('Context needs to be given', t => {
  t.teardown(teardown)
  t.plan(1)

  setTraceFunction(() => { }) // Need to set this, unless createTracer() hits NoTracingClass
  t.exception(() => createTracer(/* no context here */))
})

test('ObjectId remains the same in an objects lifetime', t => {
  t.teardown(teardown)
  t.plan(2)

  setTraceFunction(({ object }) => {
    if (!firstObjectId) {
      firstObjectId = object.id
    } else {
      t.is(object.id, firstObjectId)
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

  setTraceFunction(({ object }) => {
    t.is(object.id, 1)
  })

  class SomeClass {
    constructor () {
      this.tracer = createTracer(this)
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

  setTraceFunction(({ object }) => {
    if (!firstObjectId) {
      firstObjectId = object.id
    } else {
      t.is(object.id, firstObjectId + 1)
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

  setTraceFunction(({ object }) => {
    objectIdFromTracing = object.id
  })

  const someModule = new SomeModule()
  let objectIdFromTracing
  const objectIdFromObject = someModule.getTracingObjectId() // The function returns this.tracing.getObjectId()

  t.is(objectIdFromObject, objectIdFromTracing)
})

test('When parent initiated with props, read them in parentObject.props', t => {
  t.teardown(teardown)
  t.plan(1)

  setTraceFunction(({ parentObject }) => {
    t.alike(parentObject.props, someProps)
  })

  class Parent {
    constructor () {
      this.tracer = createTracer(this, { props: someProps })
    }

    createChild () {
      return new Child(this.tracer)
    }
  }

  class Child {
    constructor (parentTracer) {
      this.tracer = createTracer(this, { parent: parentTracer })
    }

    foo () {
      this.tracer.trace()
    }
  }

  const someProps = { some: 'value' }
  const parent = new Parent()
  const child = parent.createChild()
  child.foo()
})

test('Hypertrace nitiated with props are added as object.props', t => {
  t.teardown(teardown)
  t.plan(1)

  setTraceFunction(({ object }) => {
    t.alike(object.props, someProps)
  })

  class SomeClass {
    constructor () {
      this.tracer = createTracer(this, { props: someProps })
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

test('Not settings props leaves it underfned', t => {
  t.teardown(teardown)
  t.plan(1)

  setTraceFunction(({ object }) => {
    t.absent(object.props)
  })

  const someModule = new SomeModule()

  someModule.foo()
})

test('Instantiating hypertrace without a parent hypertrace, sets parentObject to undefined', t => {
  t.teardown(teardown)
  t.plan(1)

  setTraceFunction(({ parentObject }) => {
    t.absent(parentObject)
  })

  class SomeClass {
    constructor () {
      this.tracer = createTracer(this)
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

  setTraceFunction(({ object, parentObject, caller }) => {
    t.is(object.className, 'SomeChild')
    t.is(object.id, 1)
    t.is(parentObject.className, 'SomeParent')
    t.is(parentObject.id, 1)
    t.is(caller.functionName, 'foo')
  })

  class SomeParent {
    constructor () {
      this.tracer = createTracer(this)
    }

    createChild () {
      const child = new SomeChild(this)
      return child
    }
  }

  class SomeChild {
    constructor (parent) {
      this.tracer = createTracer(this, {
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

test('setTraceFunction before initiating class means that it is called', t => {
  t.teardown(teardown)
  t.plan(1)

  setTraceFunction(() => {
    t.pass()
  })

  const mod = new SomeModule()
  mod.foo()
})

test('setTraceFunction after initiating class means that it is not called', t => {
  t.teardown(teardown)
  t.plan(0)

  const mod = new SomeModule()
  mod.foo()

  setTraceFunction(() => {
    t.fail()
  })
})
