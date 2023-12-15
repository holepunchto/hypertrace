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
    t.is(typeof object.id, 'number')
  })

  const someModule = new SomeModule()
  someModule.foo()
})

test('Props are passed as caller.props', t => {
  t.teardown(teardown)
  t.plan(1)

  Hypertrace.setTraceFunction(({ caller }) => {
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

  t.exception(() => new Hypertrace(/* no context here */))
})

test('ObjectId remains the same in an objects lifetime', t => {
  t.teardown(teardown)
  t.plan(2)

  Hypertrace.setTraceFunction(({ object }) => {
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

  Hypertrace.setTraceFunction(({ object }) => {
    t.is(object.id, 1)
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

  Hypertrace.setTraceFunction(({ object }) => {
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

  Hypertrace.setTraceFunction(({ parentObject }) => {
    t.alike(parentObject.props, someProps)
  })

  class Parent {
    constructor () {
      this.tracer = new Hypertrace(this, { props: someProps })
    }

    createChild () {
      return new Child(this.tracer)
    }
  }

  class Child {
    constructor (parentTracer) {
      this.tracer = new Hypertrace(this, { parent: parentTracer })
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

  Hypertrace.setTraceFunction(({ object }) => {
    t.alike(object.props, someProps)
  })

  class SomeClass {
    constructor () {
      this.tracer = new Hypertrace(this, { props: someProps })
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

  Hypertrace.setTraceFunction(({ object }) => {
    t.absent(object.props)
  })

  const someModule = new SomeModule()

  someModule.foo()
})

test('Instantiating hypertrace without a parent hypertrace, sets parentObject to undefined', t => {
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
    t.is(object.id, 1)
    t.is(parentObject.className, 'SomeParent')
    t.is(parentObject.id, 1)
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
