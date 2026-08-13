// amplify/backend.ts
//
// Assembles: Cognito (auth) + S3 (storage) + Lambda (saveProfile) + a
// DynamoDB table + a REST API Gateway in front of the Lambda, secured by
// a Cognito User Pool authorizer -- mirroring the workshop's
// IAM + Amplify + Cognito + Lambda + API Gateway + DynamoDB stack, but
// defined as code instead of clicked together in the console.
//
// Amplify Data/AppSync isn't used here (unlike the earlier version of this
// project) since the template this follows uses a REST API + Lambda proxy
// integration, not GraphQL.
import { defineBackend } from '@aws-amplify/backend';
import { aws_dynamodb as dynamodb, aws_apigateway as apigateway } from 'aws-cdk-lib';
import { auth } from './auth/resource';
import { storage } from './storage/resource';
import { saveProfile } from './functions/save-profile/resource';

const backend = defineBackend({
  auth,
  storage,
  saveProfile,
});

// ─── DynamoDB table (replaces the manually-created "ProfileEntries" table) ──
const apiStack = backend.createStack('profile-api-stack');

const profileTable = new dynamodb.Table(apiStack, 'ProfileEntries', {
  partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
  billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
});

// ─── IAM grants ───────────────────────────────────────────────────────────
backend.storage.resources.bucket.grantReadWrite(backend.saveProfile.resources.lambda);
profileTable.grantWriteData(backend.saveProfile.resources.lambda);

// Env vars the handler reads via $amplify/env/save-profile.
backend.saveProfile.resources.lambda.addEnvironment(
  'PROFILE_ENTRIES_TABLE_NAME',
  profileTable.tableName
);
backend.saveProfile.resources.lambda.addEnvironment(
  'PROFILE_CARD_PHOTOS_BUCKET_NAME',
  backend.storage.resources.bucket.bucketName
);

// ─── API Gateway, secured by the Cognito user pool from auth/resource.ts ───
const restApi = new apigateway.RestApi(apiStack, 'ProfileApi', {
  restApiName: 'profile-card-api',
  defaultCorsPreflightOptions: {
    allowOrigins: apigateway.Cors.ALL_ORIGINS,
    allowMethods: ['POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
  },
});

const authorizer = new apigateway.CognitoUserPoolsAuthorizer(apiStack, 'ProfileApiAuthorizer', {
  cognitoUserPools: [backend.auth.resources.userPool],
});

const profileResource = restApi.root.addResource('profile');
profileResource.addMethod(
  'POST',
  new apigateway.LambdaIntegration(backend.saveProfile.resources.lambda),
  {
    authorizationType: apigateway.AuthorizationType.COGNITO,
    authorizer,
  }
);

// Surfaced in `npx ampx sandbox` / pipeline-deploy output -- copy this into
// config.js's api.invokeUrl.
backend.addOutput({
  custom: {
    apiInvokeUrl: restApi.url,
  },
});
