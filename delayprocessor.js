let moment = require('moment');
let uuid = require('uuid');
//let Joi = require('joi');
let AWS = require('aws-sdk');

/**********************************************/
const MAXLENGTH = 10;
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

  let dbQueryParams = undefined;
    
  paramsQuery, dbQueryParams = dateSplits(event.query, paramsQuery, dbQueryParams);
  
  console.log('paramsQuery: ', paramsQuery);
  console.log('dbQueryParams: ', dbQueryParams);
    
  factoryGetDBData(event.query, cb, paramsQuery, dbQueryParams);
};


function dateSplits(query, paramsQuery, dbQueryParams) {
  if ((query !== undefined) && (query.fromDate !== undefined)) {  
    console.log('query.fromDate: ',query.fromDate);
    let fromDateSplits = query.fromDate.split('-');
    let fromDate = new Date(fromDateSplits[0], fromDateSplits[1] - 1, fromDateSplits[2]);
    
    let toDate = "";
    if (query.toDate !== undefined) {  
      let toDateSplits = query.toDate.split('-');
      toDate = new Date(toDateSplits[0], toDateSplits[1] - 1, toDateSplits[2]);
    } else {
      toDate = new Date(fromDate.getFullYear() + 1, fromDateSplits[1] - 1, fromDateSplits[2]);    
    }
      
    dbQueryParams = {
      ':fromTimestamp': fromDate.toISOString(),
      ':toTimestamp': toDate.toISOString()
    };

    console.log('dbQueryParams: ', dbQueryParams);
    paramsQuery.FilterExpression = 'departureDetails.scheduledTimestamp > :fromTimestamp and departureDetails.scheduledTimestamp <= :toTimestamp';
  }
    
  return (paramsQuery, dbQueryParams);
}

function processDBData(data) {
  let result = [];
  for (let i = 0, len = data.Items.length; i < len; i++) {
    result.push(AWS.DynamoDB.Converter.unmarshall(data.Items[i]));
  }
  return result;
};


function scanDB (pageSize, pageNumber, processedCount, paramsQuery, respData) {
  let startingPoint = pageNumber * pageSize;
  return new Promise((resolve, reject) => {
    let promiseQuery = dbClient.scan(paramsQuery).promise();
    promiseQuery.then((scanData) => {
      if (((scanData.Count + processedCount) > startingPoint) && (respData.length !== pageSize)) {
        let startProc = 0;
        if (startingPoint > processedCount) {
          startProc = startingPoint - processedCount;
        }

        let endProc = scanData.Count;
        if ((endProc - startProc + respData.length) > pageSize) {
          endProc = startProc + pageSize - respData.length;
        }

        for (let i = startProc; i < endProc; i++) {
          console.log(AWS.DynamoDB.Converter.unmarshall(scanData.Items[i]));
          respData.push(AWS.DynamoDB.Converter.unmarshall(scanData.Items[i]));
        }
      }

      if (scanData.LastEvaluatedKey === undefined) {
        console.log('No more data');
        resolve({ pageSize, pageNumber, totalPages: Math.ceil((processedCount + scanData.Count) / pageSize), delays: respData });
      } else {
        console.log('Scanning again');
        paramsQuery.ExclusiveStartKey = scanData.LastEvaluatedKey;
        resolve(scanDB(pageSize, pageNumber, processedCount + scanData.Count, paramsQuery, respData));
      }
    }).catch((err) => {
      console.log('Error from scan promise: ', err);
      return reject();
    });
  });
}


function factoryGetDBData (query, cb, paramsQuery, dbQueryParams) {
  if ((query !== undefined) && (query.delayed !== undefined)) {
    dbQueryParams[':delayed'] = '0';
    if (paramsQuery.FilterExpression === undefined) {
      paramsQuery.FilterExpression = '';
    }

    if (query.delayed.trim() === 'true') {
      paramsQuery.FilterExpression += 'and delayInSeconds > :delayed';
    } else {
      paramsQuery.FilterExpression += 'and delayInSeconds = :delayed';
    }
  }

  if (dbQueryParams !== undefined) {
    let marshalledQueryParams = AWS.DynamoDB.Converter.marshall(dbQueryParams);
    paramsQuery.ExpressionAttributeValues = marshalledQueryParams;  
  }

  let pageNumber = 0;
  if ((query !== undefined) && (query.pageNumber !== undefined) && (query.pageNumber > 0)) {
    pageNumber = Number(query.pageNumber);
  }

  let pageSize = MAXLENGTH;
  if (query !== undefined) {
    if ((query.pageSize !== undefined) && (query.pageSize < MAXLENGTH) && (query.pageSize > 0)) {
      pageSize = Number(query.pageSize);
    }
  }
  let data = [];
  let scanDBPromise = scanDB(pageSize, pageNumber, 0, paramsQuery, data);

  scanDBPromise.then((data) => {
    console.log('factoryGetDBData: Success');
    cb(null, {"body": data});
  }).catch((err) => {
    console.log('Error: ', err);
    var error = new Error('ERROR: Something bad happened');
    error.name = 'requestNotOk';
    cb(error);
  });
}
