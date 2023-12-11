import test from 'brittle'
import Tracing from '../index.js'
import SomeModule from './SomeModule.js'

function teardown() {
  Tracing.clearTraceFunction()
}

test('Caller is set', t => {
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

  t.teardown(teardown)
})

test('Args are passed', t => {
  t.plan(1)

  const someModule = new SomeModule()
  const args = {
    some: 'thing'
  }

  Tracing.setTraceFunction(({ args }) => {
    t.is(args.some, 'thing')
  })

  someModule.foo(args)

  t.teardown(teardown)
})
