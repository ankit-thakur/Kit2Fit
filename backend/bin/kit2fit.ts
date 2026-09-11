#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { Kit2FitStack } from '../lib/kit2fit-stack';
import { Kit2FitV2Stack } from '../lib/kit2fit-v2-stack';

const app = new cdk.App();

// --- v1 — frozen ---
// Left deployed so the original app can still be opened for demos. Do not change
// this stack's id, or any tableName / secretName inside it: CloudFormation treats
// a rename as a replacement, and with RemovalPolicy.RETAIN that orphans the real
// challenge data behind a new, empty table. See docs/environments.md.
new Kit2FitStack(app, 'Kit2FitStack', {
  description: 'Kit2Fit fitness challenge app backend',
});

// --- v2 — pledge scoring ---
// Synthesised once the shared v1 identity resources are recorded in cdk.json
// context. Until then it is skipped, so `cdk deploy` against v1 keeps working
// unchanged. Fill these from the v1 stack's outputs:
//   sharedUserPoolId                 <- Kit2FitStack.UserPoolId
//   sharedUsersTableName             <- "Kit2Fit-Users"
//   sharedProfilePicturesBucketName  <- Kit2FitStack.ProfilePicturesBucketName
const sharedUserPoolId = app.node.tryGetContext('sharedUserPoolId') as string | undefined;
const sharedUsersTableName = app.node.tryGetContext('sharedUsersTableName') as string | undefined;
const sharedProfilePicturesBucketName = app.node.tryGetContext(
  'sharedProfilePicturesBucketName',
) as string | undefined;

if (sharedUserPoolId && sharedUsersTableName && sharedProfilePicturesBucketName) {
  new Kit2FitV2Stack(app, 'Kit2FitV2Stack', {
    description: 'Kit2Fit v2 backend — pledge scoring, shared identity with v1',
    sharedUserPoolId,
    sharedUsersTableName,
    sharedProfilePicturesBucketName,
  });
} else {
  console.warn(
    '[kit2fit] Kit2FitV2Stack skipped: set sharedUserPoolId, sharedUsersTableName and ' +
      'sharedProfilePicturesBucketName in backend/cdk.json context. See docs/environments.md.',
  );
}
