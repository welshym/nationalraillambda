var AWS = require("aws-sdk");
var fs = require('fs');

var credentials = new AWS.SharedIniFileCredentials({ profile: 'default' });
AWS.config.update({ region: 'us-east-1', credentials });

//var docClient = new AWS.DynamoDB.DocumentClient();
var docClient = new AWS.DynamoDB();

console.log("Importing Delay into DynamoDB. Please wait.");
var delayData = JSON.parse(fs.readFileSync('delays.json', 'utf8'));
console.log(delayData.delays);

delayData.delays.forEach(function(delay) {
    console.log(delay)
    
    var marshalledDelay = AWS.DynamoDB.Converter.marshall(delay);
    
    var params = {
        TableName: "delays",
        Item: marshalledDelay
    };
    console.log(params)

/*    docClient.put(params, function(err, data) {
        if (err) {
            console.error("Unable to add delay ", delay.delayDate, ". Error JSON:", JSON.stringify(err, null, 2));
        } else {
            console.log("PutItem succeeded:", delay.delayDate);
        }
    });
    */

    var promise = docClient.putItem(params).promise();
    
    promise.then(function (data) {
        console.log("PutItem succeeded:", data);
    }).catch(function(err) {
      console.log("Unable to add delay ", delay, ". Error JSON:", JSON.stringify(err, null, 2));                
    });
})