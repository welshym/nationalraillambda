var todo = require("./delayprocessor.js");

exports.handler = function(event, context, cb) {
  console.log("event.fun", JSON.stringify(event.fun));
  console.log("event", JSON.stringify(event));
  todo[event.fun](event, cb);
};
