import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';

export interface Kit2FitV2StackProps extends cdk.StackProps {
  /** Cognito user pool owned by the v1 stack. Shared so members keep their sign-in. */
  readonly sharedUserPoolId: string;
  /** Users table owned by the v1 stack. Identity only — no challenge data. */
  readonly sharedUsersTableName: string;
  /** Profile pictures bucket owned by the v1 stack. */
  readonly sharedProfilePicturesBucketName: string;
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

    // --- Handlers and API ---
    // Deliberately absent. An apigateway.RestApi with no methods fails to
    // deploy, so the API is added with the first handler rather than left as an
    // empty shell. Wire it against `this.userPool` with a
    // CognitoUserPoolsAuthorizer so v2 accepts tokens from the shared pool.

    new cdk.CfnOutput(this, 'V2UserPoolId', { value: this.userPool.userPoolId });
    new cdk.CfnOutput(this, 'V2UserPoolClientId', {
      value: this.userPoolClient.userPoolClientId,
    });
  }
}
