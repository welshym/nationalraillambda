# Setup

Deploys a Lambda based app using CloudFormation. Follows the example here:

https://cloudonaut.io/create-a-serverless-restful-api-with-api-gateway-cloudformation-lambda-and-dynamodb/

## Delays App using Cloud Formation

create the lambda code file (`lambda.zip`)

```
$ npm install --production
$ ./bundle.sh
```

create an S3 bucket in the US East (N. Virginia, `us-east-1`) region and upload the `lambda.zip` file (replace `$S3Bucket` with a S3 bucket name)

```
$ export AWS_DEFAULT_REGION=us-east-1
$ export S3Bucket=$(whoami)-apigateway
$ aws s3 mb s3://$S3Bucket
$ aws s3 cp lambda.zip s3://$S3Bucket/lambda.zip
```

create cloudformation stack (replace `$S3Bucket` with your S3 bucket name)

```
$ aws cloudformation create-stack --stack-name apigateway --template-body file://template.json --capabilities CAPABILITY_IAM --parameters ParameterKey=S3Bucket,ParameterValue=$S3Bucket
```

--capabilities CAPABILITY_IAM specifically acknowledges that the stack will modify account permission s i.e. create / delete roles.

wait until the stack is created (`CREATE_COMPLETE`)

```
$ aws cloudformation wait stack-create-complete --stack-name apigateway
```

get the `$ApiId`

```
$ aws cloudformation describe-stacks --stack-name apigateway --query Stacks[0].Outputs
```

set the `$ApiGatewayEndpoint` environment variable (replace `$ApiId`)

```
export ApiGatewayEndpoint="$ApiId.execute-api.us-east-1.amazonaws.com/v1"
```

and now [use the RESTful API](#use-the-restful-api).

### Update the stack

To update the stack use `update-stack` with updated parameters or the resources to be changed specified e.g.

Deploy a new code drop to S3 bucket with a new name: 
```
aws s3 cp lambda.zip s3://$S3Bucket/lambda2.zip
```

Update the stack to use the new code:
```
aws cloudformation update-stack --stack-name myapigateway --template-body file://template.json --capabilities CAPABILITY_IAM --parameters ParameterKey=S3Bucket,ParameterValue=$S3Bucket ParameterKey=S3Key,ParameterValue=lambda2.zip
```

# Use the RESTful API

the following examples assume that you replace `$ApiGatewayEndpoint` with `$ApiId.execute-api.us-east-1.amazonaws.com`

create a user

```
curl -vvv -X GET -d '{"email": "your@mail.com", "phone": "0123456789"}' -H "Content-Type: application/json" https://$ApiGatewayEndpoint/user
```

list delays

```
curl -vvv -X GET https://$ApiGatewayEndpoint/delays
```

create a delay

```
curl -vvv -X POST -d '{ "delayInSeconds": "66", "delayDate": "2018-03-13", "arrivalDetails": { "fullName": "Waterloo", "scheduledTimestamp": "2018-02-13T07:54:00.000Z", "crs": "WAT", "actualTimestamp": "2018-02-13T08:59:33.123Z" }, "departureDetails": { "fullName": "Petersfield", "scheduledTimestamp": "2018-02-13T06:48:33.123Z", "crs": "PTR", "actualTimestamp": "2018-02-13T06:59:33.123Z" }, "trainId": "1123" }' -H "Content-Type: application/json" https://$ApiGatewayEndpoint/user/$UserId/task
```

# Teardown

## Using CloudFormation

delete CloudFormation stack

```
$ aws cloudformation delete-stack --stack-name apigateway
```

delete S3 bucket (replace `$S3Bucket`)

```
$ aws s3 rb --force s3://$S3Bucket
```

# Notes

The S3 Bucket name is referenced within the Lambda resource through:

    "Code": {
          "S3Bucket": {"Ref": "S3Bucket"},
          "S3Key": {"Ref": "S3Key"}
        },

With the name of the bucket being passed in as a parameter on the CloudFormation command line.

    --parameters ParameterKey=S3Bucket,ParameterValue=$S3Bucket

References need to be defined in their full canonical form:

    "arrivalDetails": {
              $ref: {"Fn::Join": ["", ["https://apigateway.amazonaws.com/restapis/", {"Ref": "RestApi"}, "/models/", {"Ref": "DelayDetailsModel"}]]}
    },
    
Update the sample data in ```delays.json``` Load sample data into the DynamoDB table through:

```
node loadTableData.js
```