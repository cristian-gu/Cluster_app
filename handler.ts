// amplify/functions/save-profile/handler.ts
//
// API Gateway Lambda-proxy handler, following the same pattern as the Wild
// Rydes workshop's ride-request Lambda (see the uploaded README.md): checks
// event.requestContext.authorizer for the Cognito claims, parses the body,
// does the work, and returns a statusCode/body/headers response shape
// (with CORS headers, since this is called directly from the browser).
//
// Uploads photos to S3, then writes the profile record to DynamoDB --
// both env vars below are supplied automatically by Amplify because of the
// resource references in backend.ts (no manual .env file needed).

import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'crypto';
import { env } from '$amplify/env/save-profile';

const s3 = new S3Client({});
const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));

async function uploadToS3(dataUrl: string | null | undefined, keyName: string) {
  if (!dataUrl) return null;

  const match = dataUrl.match(/^data:(.+);base64,(.+)$/);
  if (!match) throw new Error(`Malformed image data for ${keyName}`);

  const [, contentType, base64] = match;
  const buffer = Buffer.from(base64, 'base64');

  await s3.send(
    new PutObjectCommand({
      Bucket: env.PROFILE_CARD_PHOTOS_BUCKET_NAME,
      Key: keyName,
      Body: buffer,
      ContentType: contentType,
    })
  );

  const getCommand = new GetObjectCommand({
    Bucket: env.PROFILE_CARD_PHOTOS_BUCKET_NAME,
    Key: keyName,
  });
  return getSignedUrl(s3, getCommand, { expiresIn: 60 * 60 * 24 * 7 }); // 7 days
}

function corsHeaders() {
  return { 'Access-Control-Allow-Origin': '*' };
}

function errorResponse(message: string, requestId: string) {
  return {
    statusCode: 500,
    body: JSON.stringify({ Error: message, Reference: requestId }),
    headers: corsHeaders(),
  };
}

export const handler = async (event: any, context: any) => {
  if (!event.requestContext?.authorizer) {
    return errorResponse('Authorization not configured', context.awsRequestId);
  }

  const username = event.requestContext.authorizer.claims['cognito:username'];

  try {
    const { profile = {}, photos = {}, journal = '' } = JSON.parse(event.body || '{}');

    const [coverUrl, avatarUrl] = await Promise.all([
      uploadToS3(photos.cover, `covers/${Date.now()}-cover.jpg`),
      uploadToS3(photos.avatar, `avatars/${Date.now()}-avatar.jpg`),
    ]);

    const savedAt = new Date().toISOString();

    await dynamo.send(
      new PutCommand({
        TableName: env.PROFILE_ENTRIES_TABLE_NAME,
        Item: {
          id: randomUUID(),
          username,
          savedAt,
          fullName: profile.fullName || '',
          email: profile.email || '',
          title: profile.title || '',
          ethnicity: profile.ethnicity || '',
          religion: profile.religion || '',
          city: profile.city || '',
          political: profile.political || '',
          journal: journal || '',
          coverUrl: coverUrl || '',
          avatarUrl: avatarUrl || '',
        },
      })
    );

    return {
      statusCode: 201,
      body: JSON.stringify({ ok: true, savedAt, coverUrl, avatarUrl }),
      headers: corsHeaders(),
    };
  } catch (err: any) {
    console.error(err);
    return errorResponse(err.message, context.awsRequestId);
  }
};
