# hypertrace

Add tracing and insights to classes. Supports Prometheus/Grafana.

Set a global trace function that is being invoked everytime `.trace()` is being called. Or use it with Prometheus/Grafana to get better insights into an application's behavior.

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

Then add `.setTraceFunction()` or `.setPrometheusMonitoringTarget()` in the application, when traces are needed.

`app.js`
``` js
import SomeModule from 'some-module'
import Hypertrace from 'hypertrace'

// Start server on http://localhost:4343 with a /metrics endpoint that Prometheus can use
Hypertrace.setPrometheusMonitoringTarget({ port: 4343 })

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

### static Hypertrace.setPrometheusMonitoringTarget({ port, allowedCustomProperties = [], collectDefaults = true })

A static method that hosts http://localhost:{port}/metrics which Prometheus can use as a monitoring target. Read more on how to set this up in sections below.

### static Hypertrace.clearPrometheusMonitoringTarget()

A static method that stops and removes the Prometheus monitoring target.

## Usage with Grafana and Prometheus

Prometheus is a data store for metrics. It works by pulling data from `monitoring targets` and Hypertrace can be set up to one of those. rafana is then used to visualize the data that Prometheus has stored.

A simple graph on how it's working

```
       Application   <--   Prometheus Server   <--   Grafana
(data from HTTP /metrics)     (store data)         (visualize)
```

Let's assume Grafana and Prometheus are running. See section below on how do that. Also assume that modules/classes have been instrumented like `SomeModule` in the section above. Then add this to the app:

``` js
import Hypertrace from 'hypertrace'

Hypertrace.addPrometheusMonitoringTarget({
  port: 4343
})
```

Then `http://localhost:4343` needs to be added as a monitoring target for Prometheus. See the section below for more info.

## How to install and use Prometheus on macOS

**Note**: even though this is an example for macOS, many of the steps would be the same for any OS.

### 1. Install and start Prometheus and Grafana

1. `$ brew install prometheus grafana`
2. `$ brew services start prometheus`
3. `$ brew services start grafana`

### 2. Add Prometheus as data source in Grafana

1. Open http://localhost:3000/connections/datasources/prometheus (port 3000 is the default for Grafana)
2. Click on `Add new data source`
3. Write `http://localhost:9090` for `Prometheus server URL`
4. Click `Save & Test`

Verify that it works by going to http://localhost:3000/explore and click on the `Metric` dropdown. It should have a long list of names called `prometheus_...`

### 3. Add your application as a Promethus monitoring target

1. Write some code that uses an express(-like) server

``` js
const express = require('express')
const Hypertrace = require('hypertrace')

const app = express()

Hypertrace.addPrometheusMonitoringTarget({
  app,
  port: 4343
}) // Port can be anything you want
```

2. Update the Prometheus config file located at `/opt/homebrew/etc/prometheus.yml`

```
scrape_configs:
  # ...
  - job_name: "my-application"
    static_configs:
    - targets: ["localhost:4343"] # Same port as in the config
```

3. Restart Prometheus

```
$ brew services restart prometheus
```

4. Run your application

Start your application to make sure that Prometheus are able to pull data

5. Verify that Prometheus can pull data

Open http://localhost:9090/targets (port 9090 is the default for Prometheus).

It should say `my-application (1/1 ...)`. Click on `show more` next to it, and verify that the state is `UP`. It may take ~30 seconds after the application has started until there's data.

### 4. Visualize data in Grafana

Everything is now ready to be visualized in Grafana. To make sure that everything works, follow this:

1. Go to http://localhost:3000/dashboard/new to create new dashboard
2. Click `Add visualization`
3. Click `Prometheus`
4. For the `Metric`, use `nodejs_eventloop_lag_seconds` and for `Label filters` set `app=my-application`. You can also use this code directly, `nodejs_eventloop_lag_seconds{app="chat-app"}`
5. Click on `Run queries`
6. A graph should show itself.

### Examples of filters in Grafana

Group function calls to `Hypercore` together to easier investigate which function is being called a lot.

`$__rate_interval` makes then length of each tick/step dynamic

```
sum by (caller_functionname) (
  rate(
    function_counter{caller_classname="Hypercore"}[$__rate_interval]
  )
)
```
