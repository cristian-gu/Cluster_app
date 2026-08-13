// amplify/storage/resource.ts
// S3 bucket for cover/avatar photos -- unchanged.
import { defineStorage } from '@aws-amplify/backend';

export const storage = defineStorage({
  name: 'profileCardPhotos',
  access: (allow) => ({
    'covers/*': [allow.authenticated.to(['read', 'write'])],
    'avatars/*': [allow.authenticated.to(['read', 'write'])],
  }),
});
