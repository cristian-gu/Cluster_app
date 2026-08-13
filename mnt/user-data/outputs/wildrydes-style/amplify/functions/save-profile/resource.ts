// amplify/functions/save-profile/resource.ts
// Lambda definition. Same function as before, but now invoked through API
// Gateway (see backend.ts) instead of an AppSync custom mutation, so it
// receives/returns raw API Gateway proxy events.
import { defineFunction } from '@aws-amplify/backend';

export const saveProfile = defineFunction({
  name: 'save-profile',
  entry: './handler.ts',
  timeoutSeconds: 30,
});
