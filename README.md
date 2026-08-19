# Profile Card App (Next.js + Cognito, all-AWS)

A static profile-card app (`public/index.html` + `public/app.js`) backed by
a Cognito-authenticated API that persists data to S3 (photos) and DynamoDB
(profile/journal fields). Two interchangeable ways to run the API:

1. **Next.js API route** (`pages/api/save-profile.js`) — deploy on
   **AWS Amplify Hosting**, connected straight to this GitHub repo.
2. **AWS Lambda** (`lambda/save-profile-handler.js`) behind
   **Amazon API Gateway** — same logic, same request/response shape, for
   a Lambda-first deployment instead of/alongside Amplify Hosting.

Both paths require a valid **Amazon Cognito** access token on every
request; unauthenticated requests get `401`.

> **Security note:** an earlier version of this repo had real AWS access
> keys committed in comments in `save-profile.js` and `env_local.example`.
> Both are removed here. If those keys (`AKIASRDLQKZEHLEVDWNB...`) were
> ever pushed anywhere, **deactivate that IAM access key in the AWS
> console now** and issue a new one — treat it as burned regardless of
> whether the repo was public.

---

## Architecture

```
index.html ── config.js (Cognito pool/client IDs, API base URL)
           ── cognito-auth.js (sign in/out, holds tokens in sessionStorage)
           ── app.js (sends Authorization: Bearer <access token> on every save)
                 │
                 ▼
      pages/api/save-profile.js  (Amplify Hosting)
                 OR
      lambda/save-profile-handler.js  (API Gateway + Lambda)
                 │
                 ├── verifies token against Cognito User Pool (aws-jwt-verify)
                 ├── S3.PutObject      → cover/avatar photos
                 └── DynamoDB.PutItem  → profile/journal record (keyed by
                                          Cognito `sub` as userId)
```

## Repo layout

```
public/index.html, app.js, config.js, cognito-auth.js   ← static frontend
pages/api/save-profile.js                                ← Next.js API route
lib/verifyCognitoToken.js                                 ← shared JWT check
lambda/save-profile-handler.js                            ← Lambda version
lambda/test-save-profile-handler.js                       ← Lambda unit test
amplify/auth/resource.ts, amplify/backend.ts               ← Amplify Gen2 auth def
.github/workflows/ci.yml                                   ← runs tests on push
env_local.example                                          ← copy to .env.local
```

---

## 1. Amazon Cognito (auth)

**Option A — via Amplify Gen2 (`amplify/auth/resource.ts`):**
```bash
npm install
npx ampx sandbox
```
This provisions a User Pool + App Client and prints the `userPoolId` /
`userPoolClientId` — copy them into `public/config.js`.

**Option B — by hand in the console:**
1. Cognito → *Create user pool* → sign-in with email.
2. App integration → *Create app client* → **public client, no secret**,
   and under "Authentication flows" enable **`ALLOW_USER_PASSWORD_AUTH`**
   and **`ALLOW_REFRESH_TOKEN_AUTH`** (cognito-auth.js needs both).
3. Copy the **User pool ID** and **App client ID** into `public/config.js`
   and into `.env.local` as `COGNITO_USER_POOL_ID` / `COGNITO_CLIENT_ID`.

`cognito-auth.js` talks to Cognito directly over HTTPS (no SDK), exposing
`window.CognitoAuth.{signUp, confirmSignUp, signIn, signOut, refresh,
isSignedIn, getAccessToken, getIdToken}`. Wire a login form's `onclick` to
`signIn()` / `signOut()` in `app.js`.

## 2. IAM (execution permissions)

Whatever runs the API — the Amplify Hosting compute role, or the Lambda's
execution role — needs:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject"],
      "Resource": "arn:aws:s3:::your-bucket-name/*"
    },
    {
      "Effect": "Allow",
      "Action": ["dynamodb:PutItem"],
      "Resource": "arn:aws:dynamodb:<region>:<account-id>:table/ProfileEntries"
    },
    {
      "Effect": "Allow",
      "Action": ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"],
      "Resource": "arn:aws:logs:<region>:<account-id>:log-group:/aws/lambda/*"
    }
  ]
}
```
(The `logs:*` block is only needed for the Lambda path — CloudWatch Logs.)

Attach this as the execution role's policy; **don't** create a long-lived
IAM user access key for this unless you truly need to run outside AWS
compute (see the note at the top of `env_local.example`).

## 3. Amazon S3 + DynamoDB (storage)

```bash
aws s3 mb s3://your-bucket-name --region us-west-1

aws dynamodb create-table \
  --table-name ProfileEntries \
  --attribute-definitions AttributeName=id,AttributeType=S \
  --key-schema AttributeName=id,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region us-west-1
```

## 4. AWS Lambda + Amazon API Gateway (alternative to Amplify Hosting)

`lambda/save-profile-handler.js` is a drop-in Lambda version of the API
route — same env vars, same S3/DynamoDB calls, same Cognito check, but
speaking API Gateway's Lambda-proxy event/response shape instead of
Next.js's `req`/`res`.

**Deploy (console, quickest path):**
1. Lambda → *Create function* → Node.js 20.x → attach the IAM role above.
2. Zip `lambda/`, `lib/`, and `node_modules/` together and upload, or use
   `zip -r function.zip lambda lib node_modules` from the repo root.
3. Set handler to `lambda/save-profile-handler.handler`.
4. Set environment variables: `AWS_REGION`, `S3_BUCKET`, `DYNAMODB_TABLE`,
   `ALLOWED_ORIGIN`, `COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID`.
5. API Gateway → *Create API* → **HTTP API** → integrate with this
   Lambda → route `POST /api/save-profile` (and `OPTIONS /api/save-profile`
   for the CORS preflight, or enable API Gateway's built-in CORS instead of
   the handler's own — not both, to avoid duplicate headers).
6. Point `public/config.js`'s `apiBaseUrl` at the API Gateway invoke URL.

**Test the handler locally, no AWS needed:**
```bash
npm run test:lambda
```
This runs `lambda/test-save-profile-handler.js`, which mocks Cognito
verification and the AWS SDK clients and checks: OPTIONS preflight → 204,
missing/invalid token → 401, valid token + body → 200 with
`{ ok, savedAt, coverUrl, avatarUrl }`, wrong method → 405. Read that file
directly for the full test code — it's plain Node with `assert`, no test
framework/runner required.

## 5. AWS Amplify Hosting + GitHub

Amplify Hosting builds this repo directly from GitHub on every push:

1. Amplify Console → *Host a web app* → **GitHub** → authorize → pick this
   repo/branch. Amplify auto-detects the Next.js build settings.
2. App settings → Environment variables → add everything from
   `env_local.example` (`AWS_REGION`, `S3_BUCKET`, `DYNAMODB_TABLE`,
   `ALLOWED_ORIGIN` — set to your Amplify domain once you have it —
   `COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID`). Omit the AWS access
   key/secret; Amplify's compute role covers it once the IAM policy above
   is attached.
3. Every push to the connected branch triggers a new build/deploy
   automatically — that's the "GitHub-compatible backend" piece.

`.github/workflows/ci.yml` is a separate, lightweight check that runs on
every push/PR (Lambda unit tests + a Next.js build check) — it needs no
AWS credentials and doesn't deploy anything; Amplify's own GitHub
integration handles deployment.

## Local setup

```bash
npm install
cp env_local.example .env.local
# fill in .env.local: AWS region, bucket, table, ALLOWED_ORIGIN, Cognito IDs
npm run dev
```
Also fill in `public/config.js` with the same Cognito pool/client IDs plus
`apiBaseUrl` pointing at `http://localhost:3000` for local testing.

## Request / response shape (unchanged)

```json
// POST /api/save-profile
// Headers: Authorization: Bearer <Cognito access token>
{
  "profile": { "fullName": "...", "email": "...", "title": "...", "ethnicity": "...", "religion": "...", "city": "...", "political": "..." },
  "photos": { "cover": "data:image/jpeg;base64,...", "avatar": "data:image/png;base64,..." },
  "journal": "Today I..."
}
```
```json
{ "ok": true, "savedAt": "2026-08-19T21:49:00.000Z", "coverUrl": "https://...", "avatarUrl": "https://..." }
```
`401 { "ok": false, "error": "Unauthorized" }` if the token is missing,
expired, or fails verification against the User Pool.

## Notes

- **CORS**: `ALLOWED_ORIGIN` must be an *exact* origin (not `*`) now that
  requests carry an `Authorization` header — wildcard origins can't be
  paired with credentialed/authenticated cross-origin requests.
- Presigned S3 URLs expire after 7 days; put CloudFront + origin access
  control in front of the bucket if you need permanent links instead.
- DynamoDB items now include `userId` (the Cognito `sub`) alongside the
  generated `id`, so you can query/upsert per user later even though each
  save still writes a new item.
- `ethnicity`, `religion`, and `political` are collected as free-text
  profile fields and stored as entered — if this app is ever used beyond
  a personal/portfolio context, treat that as sensitive personal data
  subject to whatever privacy rules apply where your users are (e.g. GDPR
  special-category data), and consider making those fields optional.
