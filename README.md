# hypertrace

Add tracing and insights to classes.

Set a global trace function that is being invoked everytime `.trace()` is being called.

There is support for Prometheus/Grafana through [hypertrace-prometheus](https://github.com/holepunchto/hypertrace-prometheus) to get better visual insights into an application's behavior.

## Installation

```
$ npm i hypertrace
```

## Usage / instrumentation

First add Hypertrace to classes where insights are needed

`some-module.js`
``` js
import Hypertrace from 'hypertrace'

export default class SomeModule {
  constructor () {
    this.tracer = new Hypertrace(this, {
      customProperties: {
        someCustom: 'property'
      }
    })
  }

  createChild () {
    const child = new Child(this.tracer)
    return child
  }
}

class Child {
  constructor (parentTracer) {
    this.tracer = new Hypertrace(this, {
      parent: parentTracer,
      customProperties: {
        someCustom: 'property'
      }
    })
  }

  foo (val) {
    this.tracer.trace({ val })
  }
}
```

Then add `.setTraceFunction()` when traces are needed.

`app.js`
``` js
import SomeModule from 'some-module'
import Hypertrace from 'hypertrace'

// Log everytime .trace() is being called
Hypertrace.setTraceFunction(({ object, parentObject, caller, args, customProperties }) => {
  console.log({
    object,
    parentObject,
    caller,
    args,
    customProperties
  })
})

const mod = new SomeModule()
const child = mod.createChild()
child.foo(123)

/*
  Prints out:
  {
    object: {
      className: 'Child',
      id: 1
    },
    parentObject: {
      className: 'SomeModule',
      id: 1
    },
    caller: {
      functionName: 'foo',
      filename: '/test/Some.js',
      line: 29,
      column: 17
    },
    args: {
      val: 123
    },
    customProperties: {
      someCustom: 'property'
    }
  }
*/
```

## Methods

### new Hypertrace(context, { customProperties, parent })

Create a new Hypertrace instance inside a class. Often used in the `constructor`.

- **customProperties**: (optional) Some properties that are passed along to the trace function
- **parent**: (optional) A parent hypertrace instance to allow deeper understanding of structure. This is pased to the trace function.

``` js
class SomeClass {
  constructor() {
    this.tracer = new Hypertrace(this)
  }
}
```

#### .trace([args])

Args are optional. They are passed to trace function, but are not used with Prometheus, because there is a limitation with Prometehus that label names cannot be set dynamically.

- **args**: (optional) A map of arguments that's passed to the trace function

``` js
class SomeClass {
  constructor() {
    this.tracer = new Hypertrace(this)
  }
  fn (some, props) {
    this.tracer.trace({ some, props })
  }
}
```

### static Hypertrace.setTraceFunction(({ object, parentObject, caller, args, customProperties }) => { ... })

A static method that sets a global trace function that is invoked everytime `.trace()` is being called.

- **object**: Contains `className` and `id`
- **parentObject**: If hypertrace was initiated with `parent` then it contains `className` and `id`
- **caller**: Contains `functionName`, `filename`, `line`, `column`
- **args**: Contains the args passed to `.trace(args)`
- **customProperties**: If hypertrace was initiated with `customProperties` then it contains those properties

### static Hypertrace.clearTraceFunction()

A static method that clears the global trace function.
