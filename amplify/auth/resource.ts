// amplify/auth/resource.ts
//
// AWS Amplify Gen2 backend definition for the Cognito User Pool + App
// Client that cognito-auth.js signs into. This file is only used if you
// deploy the backend via the Amplify Gen2 CLI (`npx ampx sandbox` /
// `npx ampx pipeline-deploy`), which provisions:
//   - a Cognito User Pool (auth.userPoolId)
//   - a User Pool App Client with no secret, USER_PASSWORD_AUTH enabled
//     (auth.userPoolClientId)
//
// Requires the "@aws-amplify/backend" and "@aws-amplify/backend-cli" dev
// dependencies (see package.json). If you'd rather create the User Pool
// by hand in the Cognito console, you don't need this file at all — just
// fill in public/config.js directly with the pool's ID and client ID.
//
// After `npx ampx sandbox` finishes, copy the printed userPoolId and
// userPoolClientId into public/config.js.

import { defineAuth } from '@aws-amplify/backend';

export const auth = defineAuth({
  loginWith: {
    email: true,
  },
  // Attributes collected at sign-up. Extend this list to match whatever
  // profile fields you want Cognito itself to own (as opposed to fields
  // that only ever live in DynamoDB via save-profile).
  userAttributes: {
    email: {
      required: true,
      mutable: true,
    },
  },
});
