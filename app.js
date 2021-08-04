// Bootstrap the AppD Agent as early as possible!
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

// We'll use Express for our HTTP (TCP) Server
const express = require("express");
const expressPort = 8080;
// We'll use dgram for our UDP Server
const dgram = require("dgram");
const dgramPort = 8082;
// We'll use http for our downstream HTTP calls
const http = require("http");
const { endianness } = require("os");

// Instantiate our Server objects
const app = express();
const socket = dgram.createSocket("udp4");

// Downstream HTTP Call Helper Function
function sendHttpGet() {
  http
    .get("http://httpbin.org/get", (resp) => {
      let data = "";

      // A chunk of data has been received.
      resp.on("data", (chunk) => {
        data += chunk;
      });

      // The whole response has been received. Print out the result.
      resp.on("end", () => {
        console.log("All OK, received downstream response!");
        console.log(JSON.parse(data));
      });
    })
    .on("error", (err) => {
      console.log("Error: " + err.message);
    });
}

/*
 *  UDP Handlers
 */

// Upon spin up
socket.on("listening", () => {
  let addr = socket.address();
  console.log(
    `dgram is listening for UDP packets at ${addr.address}:${addr.port}`
  );
});

// Upon error
socket.on("error", (err) => {
  console.error(`UDP error: ${err.stack}`);
});

// Upon message received - here we go!
socket.on("message", (msg, rinfo) => {
  // Start the AppDynamics Business Transaction
  console.log(
    "Starting Custom Business Transaction Event 'udp_message_received'"
  );
  var transaction = appd.startTransaction("udp_message_received");
  // Write the message contents out to the console
  console.log("Recieved UDP message, here are the contents: " + msg);
  console.log("Now sending downstream call.");
  // Prepare the AppDynamics Business Transaction for an Exit Call
  // This code can be used if the Exit Call is automatically detected
  transaction.beforeExitCall = function getExitInfo(exitCall) {
    // Create the Correlation Header from the captured Exit Call, just in case downstream is instrumented with AppD
    var exitCallCorrel = transaction.createCorrelationInfo(exitCall);
    console.log(`exitCallCorrel = ${exitCallCorrel}`);
    return exitCall;
  };
  // Send downstream HTTP GET
  sendHttpGet();
  // End the AppDynamics Business Transaction
  console.log(
    "Ending Custom Business Transaction Event 'udp_message_received'"
  );
  transaction.end();
});

/*
 *  HTTP (TCP) Handler(s)
 */

// Upon GET to any URI
app.get("*", function (req, res) {
  console.log("Received Incoming HTTP GET on Express Server!");
  console.log("Now sending downstream call.");
  sendHttpGet();
  res.send("Thanks for sending a GET request!");
});

/*
 *  Server Startup
 */

app.listen(expressPort, () => {
  console.log(`Express is listening for HTTP calls on port ${expressPort}`);
});
socket.bind(8082);

/*
 *  Unused code that may come in handy at some point
 */

/*
  // This code can be used to test whether or not an Exit Call is automatically detected
  transaction.beforeExitCall = function (call) {
    console.log('Exit Call Automatically Detected!');
    return call;
  };
  */

/*
  // This code can be used when the Exit Call is not automatically detected
  var exitCall;
  var correlInfo;
  if (detected == false) {
    console.log(
      "Exit Call not automatically detected! Creating a Custom Exit Call."
    );
    var exitCallInfo = {
      exitType: "EXIT_HTTP",
      label: "Custom HTTP Exit Call",
      backendName: "httpbin.org",
      identifyingProperties: {
        HOST: "http://httpbin.org",
        PORT: "80",
      },
    };
    // Start the AppDynamics Custom Exit Call
    console.log('Starting the AppDynamics Custom Exit Call');
    exitCall = transaction.startExitCall(exitCallInfo);
    // Create Correlation Information from the Custom Exit Call
    correlInfo = transaction.createCorrelationInfo(exitCall);
  }
  */
/*
  // If a Custom Exit Call was started, end it now
  if (detected == false) {
    console.log('Ending the AppDynamics Custom Exit Call');
    transaction.endExitCall(exitCall);
  }
  */
