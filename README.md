# holepunch-tracing

Add tracing and insights to classes in modules

## Installation

```
$ npm i @holepunch/tracing
```

## Usage

First add Tracing to modules where some insights are needed

`some-module.js`
``` js
import Tracing from '@holepunchto/tracing'

export default class SomeModule {
  constructor() {
    this.tracing = new Tracing(this)
  }

  get({ index }) {
    this.tracing.trace({ index }) // Add where needed

    return 'foobar'
  }
}
```

`app.js`
``` js
import SomeModule from 'some-module'
import Tracing from '@holepunchto/tracing'

Tracing.setTraceFunction(({ caller, args}) => {
  console.log(caller)
  console.log(args)
})

const mod = new SomeModule()
mod.get({ index: 1})
```

```
$ node app.js
{
  className: 'SomeModule',
  functionName: 'SomeModule.get',
  filename: '/some-module/index.js',
  line: 9,
  column: 17
}
{ index: 1 }
```
