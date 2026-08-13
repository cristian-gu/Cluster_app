// amplify/auth/resource.ts
// Cognito user pool backing signin.html/register.html/verify.html (via the
// vanilla amazon-cognito-identity-js SDK in cognito-auth.js) -- unchanged
// from the earlier Amplify Gen 2 setup.
import { defineAuth } from '@aws-amplify/backend';

export const auth = defineAuth({
  loginWith: {
    email: true,
  },
});
