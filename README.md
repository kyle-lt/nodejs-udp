# nodejs-udp

This project was built to explore instrumenting a Node.js app that responds to UDP packets with AppDynamics.

Jump straight to the expected [Results in AppD](#results-in-appd).

Jump straight to the [Node.js Agent API Code Explanation](#nodejs-agent-api-code-explanation).

## How to Run

#### Prepare the environment

- Edit `app.js` file and adjust existing entries in section `appd.profile` to suit your AppD environment
- Edit `.env_public` file by adding your AppD Access Key, and rename the file to `.env`

#### Run from terminal/shell

From the project root directory, run command:

```bash
node run app.js
```

After running the command, you'll see the following log o/p:

```bash
Express is listening for HTTP calls on port 8080
dgram is listening for UDP packets at 0.0.0.0:8082
```

From a separate terminal shell, send some load, e.g., using netcat:

```bash
nc -u 0.0.0.0 8082 # hit enter to establish a socket connection
hello # hit enter to send
```

Back on the initial terminal where the server is running you'll see similar log o/p to the below:

```bash
...
Starting Custom Business Transaction Event 'udp_message_received'
Recieved UDP message, here are the contents: hello

Now sending downstream call.
exitCallCorrel = undefined
Ending Custom Business Transaction Event 'udp_message_received'
All OK, received downstream response!
{
  args: {},
  headers: {
    Host: 'httpbin.org',
    Singularityheader: 'appId=64*ctrlguid=1628091108*acctguid=8bf3fd5f-2d16-475a-aaea-c8197adda7cb*ts=1631547712905*btid=1583*guid=bae08211-5fda-40c2-89f1-e87339c244b0*exitguid=1*unresolvedexitid=143*cidfrom=213*etypeorder=HTTP*cidto={[UNRESOLVED][143]}',
    'X-Amzn-Trace-Id': 'Root=1-613f7054-5774c25353b428e64319dc5b'
  },
  origin: '<OMITTED>',
  url: 'http://httpbin.org/get'
}
```

## Results in AppD

A new Business Transaction will appear named `udp_message_received`:

![nodejs-udp-business-transaction-list](/images/nodejs-udp-business-transaction-list.png)

The Business Transaction begins with the UDP packet being received, and AppD automatically traced an outgoing HTTP call to `httpbin.org`:

![nodejs-udp-business-transaction-flow-map](/images/nodejs-udp-business-transaction-flow-map.png)


## Node.js Agent API Code Explanation

Starting on [Line 6 of app.js](/app.js#L6), the Node.js agent is bootstrapped:

```node.js
var appd = require("appdynamics");
appd.profile({
  controllerHostName: "192.168.86.40",
  controllerPort: 8090,
  controllerSslEnabled: false,
  accountName: "customer1",
  //accountAccessKey: "", // provided as env var APPDYNAMICS_AGENT_ACCOUNT_ACCESS_KEY
  applicationName: "nodejs-udp",
  tierName: "web",
  nodeName: "web_node",
});
```

For easy packaging, this was done in code, but it's recommended to be done via Environment Variables, as discussed in the AppD Docs in the [Node.js Settings Reference](https://docs.appdynamics.com/21.9/en/application-monitoring/install-app-server-agents/node-js-agent/node-js-settings-reference#Node.jsSettingsReference-EnvironmentVariables).

The instrumentation happens in the `socket.on("message")` callback function beginning on [Line 72 of app.js](/app.js#L72).

A Business Transaction is started:

```node.js
var transaction = appd.startTransaction("udp_message_received");
```

A callback function is registered to handle injecting transaction context into Exit Calls:

```node.js
  transaction.beforeExitCall = function getExitInfo(exitCall) {
    // Create the Correlation Header from the captured Exit Call, just in case downstream is instrumented with AppD
    var exitCallCorrel = transaction.createCorrelationInfo(exitCall);
    console.log(`exitCallCorrel = ${exitCallCorrel}`);
    return exitCall;
  };
```

The Business Transaction is ended:

```node.js
transaction.end();
```

Further details on how to use the Node.js Agent API can be found in the [Node.js Agent API User Guide](https://docs.appdynamics.com/21.9/en/application-monitoring/install-app-server-agents/node-js-agent/node-js-agent-api-user-guide).
