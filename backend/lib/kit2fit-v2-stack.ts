import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as lambdaNode from 'aws-cdk-lib/aws-lambda-nodejs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as path from 'path';

export interface Kit2FitV2StackProps extends cdk.StackProps {
  /** Cognito user pool owned by the v1 stack. Shared so members keep their sign-in. */
  readonly sharedUserPoolId: string;
  /** Users table owned by the v1 stack. Identity only — no challenge data. */
  readonly sharedUsersTableName: string;
  /** Profile pictures bucket owned by the v1 stack. */
  readonly sharedProfilePicturesBucketName: string;
  /** Where invite links point. Configured per deployment, never hardcoded. */
  readonly appBaseUrl: string;
}

/**
 * Kit2Fit v2 — pledge-based scoring.
 *
 * Identity is shared with v1; challenge data is versioned. The user pool, Users
 * table and profile pictures bucket are imported from the v1 stack so members
 * sign in with the accounts they already have and keep the same userId (their
 * Cognito sub). Everything that encodes the scoring model is created fresh here,
 * because v1's shape — one goal per membership, points from duration — has no
 * coherent mapping onto pledges and completions.
 *
 * See docs/environments.md before changing any resource name in here or in
 * kit2fit-stack.ts.
 */
export class Kit2FitV2Stack extends cdk.Stack {
  public readonly userPool: cognito.IUserPool;
  public readonly userPoolClient: cognito.IUserPoolClient;
  public readonly usersTable: dynamodb.ITable;
  public readonly profilePicturesBucket: s3.IBucket;

  public readonly groupsTable: dynamodb.Table;
  public readonly groupMembershipsTable: dynamodb.Table;
  public readonly pledgesTable: dynamodb.Table;
  public readonly completionsTable: dynamodb.Table;
  public readonly weekScoresTable: dynamodb.Table;
  public readonly eventsTable: dynamodb.Table;
  public readonly eventRsvpsTable: dynamodb.Table;
  public readonly inviteLinkSecret: secretsmanager.Secret;

  constructor(scope: Construct, id: string, props: Kit2FitV2StackProps) {
    super(scope, id, props);

    // --- Shared identity, imported from the v1 stack ---
    // These are references, not resources: nothing here creates, modifies or
    // deletes them, and grants below attach policies to this stack's roles
    // rather than to the imported resources themselves. The v1 pool, table and
    // bucket are all RemovalPolicy.RETAIN, so they outlive the v1 stack even if
    // it is eventually deleted.
    this.userPool = cognito.UserPool.fromUserPoolId(this, 'SharedUserPool', props.sharedUserPoolId);
    this.usersTable = dynamodb.Table.fromTableName(this, 'SharedUsersTable', props.sharedUsersTableName);
    this.profilePicturesBucket = s3.Bucket.fromBucketName(
      this,
      'SharedProfilePicturesBucket',
      props.sharedProfilePicturesBucketName,
    );

    // v2 gets its own app client on the shared pool, so it can be reconfigured
    // or revoked without touching v1's client.
    this.userPoolClient = this.userPool.addClient('V2UserPoolClient', {
      userPoolClientName: 'Kit2FitV2-Web',
      authFlows: { userPassword: true, userSrp: true },
      generateSecret: false,
    });

    // --- Challenge data, versioned ---
    const table = (
      id_: string,
      tableName: string,
      partitionKey: dynamodb.Attribute,
      sortKey?: dynamodb.Attribute,
    ) =>
      new dynamodb.Table(this, id_, {
        tableName,
        partitionKey,
        ...(sortKey ? { sortKey } : {}),
        billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
        removalPolicy: cdk.RemovalPolicy.RETAIN,
      });

    const str = (name: string): dynamodb.Attribute => ({
      name,
      type: dynamodb.AttributeType.STRING,
    });

    this.groupsTable = table('V2GroupsTable', 'Kit2FitV2-Groups', str('groupId'));

    this.groupMembershipsTable = table(
      'V2GroupMembershipsTable',
      'Kit2FitV2-GroupMemberships',
      str('groupId'),
      str('userId'),
    );
    this.groupMembershipsTable.addGlobalSecondaryIndex({
      indexName: 'GSI1-UserGroups',
      partitionKey: str('userId'),
      sortKey: str('groupId'),
    });

    // Pledges belong to a membership, not a user: the same person can run
    // different pledges in different groups.
    this.pledgesTable = table(
      'V2PledgesTable',
      'Kit2FitV2-Pledges',
      str('groupIdUserId'),
      str('pledgeId'),
    );
    this.pledgesTable.addGlobalSecondaryIndex({
      indexName: 'GSI1-GroupPledges',
      partitionKey: str('groupId'),
      sortKey: str('userIdPledgeId'),
    });

    // The sort key is `${date}#${pledgeId}`, which makes "one completion per
    // pledge per day" (spec R5) a property of the primary key rather than a
    // rule the handlers have to remember. Write with a condition expression on
    // attribute_not_exists(groupIdUserId) and a duplicate is rejected by Dynamo.
    this.completionsTable = table(
      'V2CompletionsTable',
      'Kit2FitV2-Completions',
      str('groupIdUserId'),
      str('datePledgeId'),
    );
    this.completionsTable.addGlobalSecondaryIndex({
      indexName: 'GSI1-GroupDate',
      partitionKey: str('groupId'),
      sortKey: str('dateUserId'),
    });

    // Materialised at week close. Adherence is recomputable from completions,
    // but the standings and streak history are read far more often than written.
    this.weekScoresTable = table(
      'V2WeekScoresTable',
      'Kit2FitV2-WeekScores',
      str('groupIdUserId'),
      str('weekStart'),
    );
    this.weekScoresTable.addGlobalSecondaryIndex({
      indexName: 'GSI1-GroupWeek',
      partitionKey: str('groupId'),
      sortKey: str('weekStartUserId'),
    });

    this.eventsTable = table('V2EventsTable', 'Kit2FitV2-Events', str('groupId'), str('eventId'));
    this.eventsTable.addGlobalSecondaryIndex({
      indexName: 'GSI1-GroupStart',
      partitionKey: str('groupId'),
      sortKey: str('startsAt'),
    });

    this.eventRsvpsTable = table(
      'V2EventRsvpsTable',
      'Kit2FitV2-EventRsvps',
      str('eventId'),
      str('userId'),
    );

    // v2 signs its own invite links, so a v1 link can never open a v2 group.
    this.inviteLinkSecret = new secretsmanager.Secret(this, 'V2InviteLinkSecret', {
      secretName: 'kit2fit-v2/invite-link-secret',
      generateSecretString: { excludePunctuation: true, passwordLength: 48 },
    });

    // No Anthropic secret: v2 has no LLM judge. A completion is a fact the
    // member asserts, not a judgment the system makes.

    // --- Handlers ---
    // `tsconfig` is what lets esbuild resolve the `@shared/*` alias, so handlers
    // import scoring logic from shared/v2 rather than copying it into src/lib the
    // way v1 did. A copy of adherence would let the stored score and the
    // displayed score drift, which for scoring is a correctness bug.
    const tsconfig = path.join(__dirname, '../tsconfig.json');

    const tableEnv = {
      USERS_TABLE: props.sharedUsersTableName,
      V2_GROUPS_TABLE: this.groupsTable.tableName,
      V2_GROUP_MEMBERSHIPS_TABLE: this.groupMembershipsTable.tableName,
      V2_PLEDGES_TABLE: this.pledgesTable.tableName,
      V2_COMPLETIONS_TABLE: this.completionsTable.tableName,
      V2_WEEK_SCORES_TABLE: this.weekScoresTable.tableName,
      V2_EVENTS_TABLE: this.eventsTable.tableName,
      V2_EVENT_RSVPS_TABLE: this.eventRsvpsTable.tableName,
      PROFILE_PICTURES_BUCKET: props.sharedProfilePicturesBucketName,
    };

    const mkFn = (id: string, entry: string, extraEnv: Record<string, string> = {}) =>
      new lambdaNode.NodejsFunction(this, id, {
        entry: path.join(__dirname, '../src/v2/handlers', entry),
        runtime: lambda.Runtime.NODEJS_20_X,
        timeout: cdk.Duration.seconds(15),
        bundling: { sourceMap: false, tsconfig },
        environment: { ...tableEnv, ...extraEnv },
      });

    const getMeFn = mkFn('V2GetMeFn', 'users/getMe.ts');
    const updateMeFn = mkFn('V2UpdateMeFn', 'users/updateMe.ts');
    const createGroupFn = mkFn('V2CreateGroupFn', 'groups/createGroup.ts');
    const listMyGroupsFn = mkFn('V2ListMyGroupsFn', 'groups/listMyGroups.ts');
    const getGroupFn = mkFn('V2GetGroupFn', 'groups/getGroup.ts');
    const createInviteLinkFn = mkFn('V2CreateInviteLinkFn', 'groups/createInviteLink.ts', {
      INVITE_LINK_SECRET_ARN: this.inviteLinkSecret.secretArn,
      APP_BASE_URL: props.appBaseUrl,
    });
    const joinViaInviteFn = mkFn('V2JoinViaInviteFn', 'groups/joinViaInvite.ts', {
      INVITE_LINK_SECRET_ARN: this.inviteLinkSecret.secretArn,
    });

    // Grants on the imported Users table attach to these roles, not to the
    // table, so the v1 stack needs no change to permit v2's access.
    this.usersTable.grantReadData(getMeFn);
    this.usersTable.grantReadWriteData(updateMeFn);
    this.usersTable.grantReadData(getGroupFn);

    this.groupsTable.grantWriteData(createGroupFn);
    this.groupMembershipsTable.grantWriteData(createGroupFn);
    this.groupsTable.grantReadData(listMyGroupsFn);
    this.groupMembershipsTable.grantReadData(listMyGroupsFn);
    this.groupsTable.grantReadData(getGroupFn);
    this.groupMembershipsTable.grantReadData(getGroupFn);
    this.groupMembershipsTable.grantReadData(createInviteLinkFn);
    this.groupsTable.grantReadData(joinViaInviteFn);
    this.groupMembershipsTable.grantWriteData(joinViaInviteFn);
    this.inviteLinkSecret.grantRead(createInviteLinkFn);
    this.inviteLinkSecret.grantRead(joinViaInviteFn);

    // --- API ---
    const api = new apigateway.RestApi(this, 'Kit2FitV2Api', {
      restApiName: 'Kit2Fit v2 API',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization'],
      },
    });

    // Tokens from the shared pool, so a member signs in once and both apps
    // accept them.
    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'V2Authorizer', {
      cognitoUserPools: [this.userPool],
    });
    const withAuth = { authorizer, authorizationType: apigateway.AuthorizationType.COGNITO };

    const me = api.root.addResource('users').addResource('me');
    me.addMethod('GET', new apigateway.LambdaIntegration(getMeFn), withAuth);
    me.addMethod('PUT', new apigateway.LambdaIntegration(updateMeFn), withAuth);

    const groups = api.root.addResource('groups');
    groups.addMethod('POST', new apigateway.LambdaIntegration(createGroupFn), withAuth);
    groups.addMethod('GET', new apigateway.LambdaIntegration(listMyGroupsFn), withAuth);
    groups.addResource('join').addMethod(
      'POST',
      new apigateway.LambdaIntegration(joinViaInviteFn),
      withAuth,
    );

    const group = groups.addResource('{groupId}');
    group.addMethod('GET', new apigateway.LambdaIntegration(getGroupFn), withAuth);
    group
      .addResource('invite-link')
      .addMethod('POST', new apigateway.LambdaIntegration(createInviteLinkFn), withAuth);

    new cdk.CfnOutput(this, 'V2ApiUrl', { value: api.url });
    new cdk.CfnOutput(this, 'V2UserPoolId', { value: this.userPool.userPoolId });
    new cdk.CfnOutput(this, 'V2UserPoolClientId', {
      value: this.userPoolClient.userPoolClientId,
    });
  }
}
