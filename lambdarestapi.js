var delayproc = require("./delayprocessor.js");

exports.handler = function(event, context, cb) {
  console.log("event.fun", JSON.stringify(event.fun));
  console.log("event", JSON.stringify(event));
  delayproc[event.fun](event, cb);
};
