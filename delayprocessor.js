let moment = require('moment');
let uuid = require('uuid');
//let Joi = require('joi');
let AWS = require('aws-sdk');

/**********************************************/
let table = 'delays';
let dbClient = new AWS.DynamoDB();

let paramsQuery = {
  TableName: table,
};

/*
const DelaySchema = Joi.object({
  departureDetails: Joi.object({
    crs: Joi.string().min(3).max(3).required(),
    fullName: Joi.string().min(3).max(20).required(),
    scheduledTimestamp: Joi.string().min(10).max(24).required(),
    actualTimestamp: Joi.string().min(10).max(24).required()
  }).required(),
  arrivalDetails: Joi.object({
    crs: Joi.string().min(3).max(3).required(),
    fullName: Joi.string().min(3).max(20).required(),
    scheduledTimestamp: Joi.string().min(10).max(24).required(),
    actualTimestamp: Joi.string().min(10).max(24).required()
  }).required(),
  trainId: Joi.string().min(3).max(20).required(),
  delayInSeconds: Joi.number().integer().positive().required(),
  delayDate: Joi.string().min(2).max(20).required()
});
*/

function findDelay(delayDetails) {
  console.log('findDelay');

  let dbQueryParams = {
    ':t': delayDetails.trainId,
    ':d': delayDetails.delayDate
  };

  let marshalledQueryParams = AWS.DynamoDB.Converter.marshall(dbQueryParams);

  let paramsQuery = {
    TableName: table,
    ExpressionAttributeValues: marshalledQueryParams,
    KeyConditionExpression: 'delayDate = :d and trainId = :t',
    ProjectionExpression: 'arrivalDetails, departureDetails, delayInSeconds, trainId, delayDate'
  };

  let promiseQuery = dbClient.query(paramsQuery).promise();
  return promiseQuery.then((data) => {
    if (data.Count !== 0) {
      console.log('Found: ', data);
      return { found: true, dbData: processDBData(data)[0] };
    } else {
      console.log('Not found');
      return { found: false, ErrorMsg: 'Could not find it' };
    }
  }).catch((err) => {
    console.log('Error findOne');
    return { found: false, ErrorMsg: err };
  });
};

function deleteSingleItem(table, delayDate, trainId) {
  console.log('deleteSingleItem');

  let paramsQuery = {
    TableName: table,
  };
  let dbQueryParams = {
    trainId,
    delayDate
  };

  let marshalledQueryParams = AWS.DynamoDB.Converter.marshall(dbQueryParams);
  paramsQuery.Key = marshalledQueryParams;
  return dbClient.deleteItem(paramsQuery).promise();
};

/*function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}*/


function insertDelay(delayDetails) {
  console.log('insertDelay');
  let localDelayDetails = {
    departureDetails: {
      crs: delayDetails.departureDetails.crs,
      fullName: delayDetails.departureDetails.fullName,
      scheduledTimestamp: delayDetails.departureDetails.scheduledTimestamp,
      actualTimestamp: delayDetails.departureDetails.actualTimestamp
    },
    arrivalDetails: {
      crs: delayDetails.arrivalDetails.crs,
      fullName: delayDetails.arrivalDetails.fullName,
      scheduledTimestamp: delayDetails.arrivalDetails.scheduledTimestamp,
      actualTimestamp: delayDetails.arrivalDetails.actualTimestamp
    },
    trainId: delayDetails.trainId,
    delayDate: delayDetails.delayDate,
    delayInSeconds: delayDetails.delayInSeconds
  };

  let dbQueryParams = {
    ':t': delayDetails.trainId,
    ':d': localDelayDetails.delayDate,
  };

  let marshalledQueryParams = AWS.DynamoDB.Converter.marshall(dbQueryParams);

  let paramsQuery = {
    TableName: table,
    ExpressionAttributeValues: marshalledQueryParams,
    KeyConditionExpression: 'delayDate = :d and trainId = :t',
    ProjectionExpression: 'arrivalDetails, departureDetails, delayInSeconds, trainId, delayDate'
  };

  let promiseQuery = dbClient.query(paramsQuery).promise();

  return promiseQuery.then((data) => {
    let marshalledAddDelay = AWS.DynamoDB.Converter.marshall(localDelayDetails);
    let paramsAdd = {
      TableName: table,
      Item: marshalledAddDelay,
    };

    if (data.Count === 0) {
      let promiseAdd = dbClient.putItem(paramsAdd).promise();
      return promiseAdd.then((data) => {
        console.log('PutItem succeeded:');
        return { code: 201 };
      }).catch((err) => {
        console.error('Unable to putItem. Error JSON:', err);
        return { code: 500, dbData: err };
      });
    } else {
      let updateParams = {
        ':arrivalFullName': localDelayDetails.arrivalDetails.fullName,
        ':arrivalCrs': localDelayDetails.arrivalDetails.crs,
        ':arrivalActualTimestamp': localDelayDetails.arrivalDetails.actualTimestamp,
        ':arrivalScheduledTimestamp': localDelayDetails.arrivalDetails.scheduledTimestamp,
        ':departureFullName': localDelayDetails.departureDetails.fullName,
        ':departureCrs': localDelayDetails.departureDetails.crs,
        ':departureActualTimestamp': localDelayDetails.departureDetails.actualTimestamp,
        ':departureScheduledTimestamp': localDelayDetails.departureDetails.scheduledTimestamp,
        ':delayInSeconds': localDelayDetails.delayInSeconds
      };
      let marshalledUpdateDelay = AWS.DynamoDB.Converter.marshall(updateParams);

      let key = {
        delayDate: localDelayDetails.delayDate,
        trainId: delayDetails.trainId
      };
      let marshalledUpdateKey = AWS.DynamoDB.Converter.marshall(key);
      let paramsUpdate = {
        TableName: table,
        Key: marshalledUpdateKey,
        UpdateExpression: 'set arrivalDetails.crs = :arrivalCrs, arrivalDetails.fullName = :arrivalFullName, arrivalDetails.scheduledTimestamp = :arrivalScheduledTimestamp, arrivalDetails.actualTimestamp = :arrivalActualTimestamp, departureDetails.crs = :departureCrs, departureDetails.fullName = :departureFullName, departureDetails.scheduledTimestamp = :departureScheduledTimestamp, departureDetails.actualTimestamp = :departureActualTimestamp, delayInSeconds = :delayInSeconds',
        ExpressionAttributeValues: marshalledUpdateDelay,
        ReturnValues: 'UPDATED_NEW'
      };

      let promiseUpdate = dbClient.updateItem(paramsUpdate).promise();
      return promiseUpdate.then((data) => {
        console.log('Update succeeded');
        let dbData = AWS.DynamoDB.Converter.unmarshall(data.Attributes);
        dbData.delayDate = localDelayDetails.delayDate;
        dbData.trainId = delayDetails.trainId;
        return { code: 200, dbData };
      }).catch((err) => {
        console.error('Unable to update. Error JSON:', err);
        return { code: 500, dbError: err };
      });
    }
  }).catch((err) => {
    console.error('Unable to read item. Error JSON:', err);
    return { code: 500, dbError: err };
  });
};


exports.postDelaysDB = function (event, cb) {
  // '/delays'
  console.log('POST request');
/*
  const ret = Joi.validate(req.body, DelaySchema, {
    // return an error if body has an unrecognised property
    allowUnknown: false,
    // return all errors a payload contains, not just the first one Joi finds
    abortEarly: false
  });

  if (ret.error) {
    res.status(400).end(ret.error.toString());
  } else {
*/

    insertDelay(event.delay).then((insertResult) => {
      console.log('insertResult: ', insertResult);
      if (insertResult.code === 201) {
        console.log('Returning 201');
        findDelay(event.delay).then((findResult) => {
          if (findResult.found === true) {
            cb(null, {"update": "false", "body": findResult.dbData});
          } else {
            console.log('Error: ', findResult.ErrorMsg);
            var error = new Error('ERROR: ' + findResult.ErrorMsg);
            error.name = 'serverError';
            cb(error);
          };
        }).catch((err) => {
          console.log('Error: ', err);
          var error = new Error('ERROR: ' + err);
          error.name = 'serverError';
          cb(error);
        });
      } else if (insertResult.code === 200) {
        console.log('Returning 200');
        cb(null, {"update": "true", "body": insertResult.dbData});
      } else {
        console.log('Returning 500');
        console.log('Error: ', insertResult.dbError);
        var error = new Error('ERROR: ' + insertResult.dbError);
        error.name = 'serverError';
        cb(error);
      }
    });

  //}
};


exports.deleteDelaysDBDates = function (req, res) {
  // '/delays/:delayDate/:trainId'
  console.log('DELETE request');

  let paramsQuery = {
    TableName: table,
  };
  let dbQueryParams = {
    trainId: req.params.trainId,
    delayDate: req.params.delayDate
  };
  //  let marshalledQueryParams = AWS.DynamoDB.Converter.marshall(dbQueryParams);
  //  paramsQuery.Key = marshalledQueryParams;
  //  let promiseQuery = dbClient.deleteItem(paramsQuery).promise();
  console.log(dbQueryParams);
  let marshalledQueryParams = AWS.DynamoDB.Converter.marshall(dbQueryParams);
  paramsQuery.Key = marshalledQueryParams;
  console.log(paramsQuery);
  let promiseQuery = dbClient.deleteItem(paramsQuery).promise();

  promiseQuery.then((data) => {
    console.log('GET: Success');
    res.status(204).send();
  }).catch((err) => {
    console.log('Error: ', err);
    res.status(404).json({ ErrorMsg: 'Something bad happened' });
  });
};

exports.deleteDelaysDB = function (req, res) {
  // '/delays'
  console.log('DELETE request');

  let paramsQuery = {
    TableName: table,
  };

  let promiseQuery = dbClient.scan(paramsQuery).promise();
  promiseQuery.then((data) => {
    let unmarshalledData = processDBData(data);
    let promises = [];
    for (let i = 0; i < data.Count; i++) {
      promises.push(deleteSingleItem('delays', unmarshalledData[i].delayDate, unmarshalledData[i].trainId));
    }

    Promise.all(promises).then((results) => {
      res.status(204).send();
    }).catch((err) => {
      console.log('Error: ', err);
      res.status(500).json({ ErrorMsg: 'Something bad happened' }).send();
    });
  }).catch((err) => {
    console.log('Error: ', err);
    res.status(500).json({ ErrorMsg: 'Something bad happened' });
  });
};


exports.getDelaysDB = function (event, cb) {
  // '/delays'
  console.log('GET: /delays');

  let paramsQuery = {
    TableName: table
  };

  if ((event.query !== undefined) && (event.query.delayed !== undefined)) {
    let dbQueryParams = {
      ':s': '0',
    };
    let marshalledQueryParams = AWS.DynamoDB.Converter.marshall(dbQueryParams);
    paramsQuery.ExpressionAttributeValues = marshalledQueryParams;

    if (event.query.delayed.trim() === 'true') {
      paramsQuery.FilterExpression = 'delayInSeconds > :s';
    } else {
      paramsQuery.FilterExpression = 'delayInSeconds = :s';
    }
  }

  let promiseQuery = dbClient.scan(paramsQuery).promise();

  console.log('query string: ', event.query);
  console.log('app.get /delays params: ', paramsQuery);
  promiseQuery.then((data) => {
    console.log('GET: Success');
    console.log('GET: ', processDBData(data));
    cb(null, {"body": processDBData(data)});
  }).catch((err) => {
    console.log('Error: ', err);
    var error = new Error('ERROR: Something bad happened');
    error.name = 'requestNotOk';
    cb(error);
  });
};

exports.getDelaysDBDate = function(req, res) {
  // '/delays/:fromDate'
  console.log('GET fromDate request');
  console.log(req.params);
  console.log(req.query);

  let fromDateSplits = req.params.fromDate.split('-');
  let fromDate = new Date(fromDateSplits[0], fromDateSplits[1] - 1, fromDateSplits[2]);

  let toDate = new Date(fromDate.getFullYear() + 1, fromDateSplits[1] - 1, fromDateSplits[2]);

  let paramsQuery = {
    TableName: table
  };

  let dbQueryParams = {
    ':fromTimestamp': fromDate.toISOString(),
    ':toTimestamp': toDate.toISOString()
  };

  console.log(dbQueryParams);

  if (req.query.delayed !== undefined) {
    dbQueryParams[':s'] = '0';

    if (req.query.delayed.trim() === 'true') {
      paramsQuery.FilterExpression = 'departureDetails.scheduledTimestamp > :fromTimestamp and departureDetails.scheduledTimestamp <= :toTimestamp and delayInSeconds > :s';
    } else {
      paramsQuery.FilterExpression = 'departureDetails.scheduledTimestamp > :fromTimestamp and departureDetails.scheduledTimestamp <= :toTimestamp and delayInSeconds = :s';
    }
  } else {
    paramsQuery.FilterExpression = 'departureDetails.scheduledTimestamp > :fromTimestamp and departureDetails.scheduledTimestamp <= :toTimestamp';
  }

  let marshalledQueryParams = AWS.DynamoDB.Converter.marshall(dbQueryParams);
  paramsQuery.ExpressionAttributeValues = marshalledQueryParams;

  console.log('app.get: ', paramsQuery);

  let promiseQuery = dbClient.scan(paramsQuery).promise();

  promiseQuery.then((data) => {
    console.log('GET: Success');
    console.log('GET: ', data.Items);
    res.status(200).json(processDBData(data));
  }).catch((err) => {
    console.log('Error: ', err);
    res.status(404).json({ ErrorMsg: 'Something bad happened' });
  });
};

function processDBData(data) {
  let result = [];
  for (let i = 0, len = data.Items.length; i < len; i++) {
    result.push(AWS.DynamoDB.Converter.unmarshall(data.Items[i]));
  }
  return result;
};

exports.getDelaysDBDates = function (req, res) {
  // '/delays/:fromDate/:toDate'  
  console.log('GET fromDate toDate request');
  console.log(req.params);
  console.log(req.query);

  let fromDateSplits = req.params.fromDate.split('-');
  let fromDate = new Date(fromDateSplits[0], fromDateSplits[1] - 1, fromDateSplits[2]);

  let toDateSplits = req.params.toDate.split('-');
  let toDate = new Date(toDateSplits[0], toDateSplits[1] - 1, toDateSplits[2]);

  let paramsQuery = {
    TableName: table
  };

  let dbQueryParams = {
    ':fromTimestamp': fromDate.toISOString(),
    ':toTimestamp': toDate.toISOString()
  };

  console.log(dbQueryParams);

  if (req.query.delayed !== undefined) {
    dbQueryParams[':s'] = '0';

    if (req.query.delayed === true) {
      paramsQuery.FilterExpression = 'departureDetails.scheduledTimestamp > :fromTimestamp and departureDetails.scheduledTimestamp <= :toTimestamp and delayInSeconds > :s';
    } else {
      paramsQuery.FilterExpression = 'departureDetails.scheduledTimestamp > :fromTimestamp and departureDetails.scheduledTimestamp <= :toTimestamp and delayInSeconds = :s';
    }
  } else {
    paramsQuery.FilterExpression = 'departureDetails.scheduledTimestamp > :fromTimestamp and departureDetails.scheduledTimestamp <= :toTimestamp';
  }

  let marshalledQueryParams = AWS.DynamoDB.Converter.marshall(dbQueryParams);
  paramsQuery.ExpressionAttributeValues = marshalledQueryParams;
  paramsQuery.FilterExpression = 'departureDetails.scheduledTimestamp > :fromTimestamp and departureDetails.scheduledTimestamp <= :toTimestamp';

  let promiseQuery = dbClient.scan(paramsQuery).promise();

  promiseQuery.then((data) => {
    console.log('GET: Success');
    res.status(200).json(processDBData(data));
  }).catch((err) => {
    console.log('Error: ', err);
    res.status(404).json({ ErrorMsg: 'Something bad happened' });
  });
};

function getValue(attribute, type) {
  if (attribute === undefined) {
    return null;
  }
  return attribute[type];
};

function mapTaskItem(item) {
  return {
    "tid": item.tid.N,
    "description": item.description.S,
    "created": item.created.N,
    "due": getValue(item.due, 'N'),
    "category": getValue(item.category, 'S'),
    "completed": getValue(item.completed, 'N')
  };
};

function mapUserItem(item) {
  return {
    "uid": item.uid.S,
    "email": item.email.S,
    "phone": item.phone.S
  };
};

exports.getDelays = function(event, cb) {
  console.log("getDelays", JSON.stringify(event));
  var res = {
    "body": "test"
  };
//  var error = new Error('ERROR: Request status code not OK');
//  error.name = 'requestNotOk';
//  cb(error);
  cb(null, res);
//  cb(null, {"body":[]});
};