// amplify/backend.ts
//
// Entry point for the Amplify Gen2 backend. Currently just wires up auth
// (amplify/auth/resource.ts). Add `data`, `storage`, etc. resources here
// later if you migrate the DynamoDB/S3 pieces into Amplify-managed
// resources instead of the hand-rolled Next.js API route / Lambda.

import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';

defineBackend({
  auth,
});
