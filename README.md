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
  constructor() {
    this.tracer = new Hypertrace(this, { someCustom: 'property' })
  }

  get ({ index }) {
    this.tracer.trace({ index }) // Add where needed

    return 'foobar'
  }

  someMethod () {
    this.tracer.trace()
  }
}
```

Then add `.setTraceFunction()` when traces are needed.

`app.js`
``` js
import SomeModule from 'some-module'
import Hypertrace from 'hypertrace'

// Log everytime .trace() is being called
Hypertrace.setTraceFunction(({ caller, args, customProperties }) => {
  console.log(caller)
  console.log(args)
  console.log(customProperties)
  /*
    {
      className: 'SomeModule',
      objectId: 1,
      functionName: 'get',
      filename: '/src/SomeModule.js',
      line: 9,
      column: 17
    }
    { index: 123 }
    { someCustom: 'property' }
  */
})

const mod = new SomeModule()
mod.get({ index: 123 })
```

## Methods

### new Hypertrace(context, [customProperties])

Create a new Hypertrace instance inside a class. Often used in the `constructor`.

`customProperties` are optional, but are passed along to the trace function, or to Prometheus.

``` js
class SomeClass {
  constructor() {
    this.tracer = new Hypertrace(this)
  }
}
```

#### .trace([args])

Args are optional. They are passed to trace function, but are not used with Prometheus, because there is a limitation with Prometehus that label names cannot be set dynamically.

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

### static Hypertrace.setTraceFunction(({ caller, args, customProperties }) => { ... })

A static method that sets a global trace function that is invoked everytime `.trace()` is being called.

### static Hypertrace.clearTraceFunction()

A static method that clears the global trace function.
