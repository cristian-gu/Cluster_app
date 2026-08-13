// config.js
// Filled in AFTER `npx ampx sandbox` (local) or an Amplify Hosting deploy.
// Read the values from the generated amplify_outputs.json:
//   cognito.userPoolId       <- auth.user_pool_id
//   cognito.userPoolClientId <- auth.user_pool_client_id
//   cognito.region           <- auth.aws_region
//   api.invokeUrl            <- the API Gateway URL output by backend.ts (see README)
window._config = {
    cognito: {
        userPoolId: '', // e.g. us-east-2_uXboG5pAb
        userPoolClientId: '', // e.g. 25ddkmj4v6hfsfvruhpfi7n4hv
        region: '' // e.g. us-east-2
    },
    api: {
        invokeUrl: '' // e.g. https://abc123.execute-api.us-east-2.amazonaws.com/prod
    }
};
