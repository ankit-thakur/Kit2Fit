import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as lambdaNode from 'aws-cdk-lib/aws-lambda-nodejs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam';

export class Kit2FitStack extends cdk.Stack {
  public readonly usersTable: dynamodb.Table;
  public readonly groupsTable: dynamodb.Table;
  public readonly groupMembershipsTable: dynamodb.Table;
  public readonly dailyLogsTable: dynamodb.Table;
  public readonly adhocChallengesTable: dynamodb.Table;
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.usersTable = new dynamodb.Table(this, 'UsersTable', {
      tableName: 'Kit2Fit-Users',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    this.usersTable.addGlobalSecondaryIndex({
      indexName: 'GSI1-Email',
      partitionKey: { name: 'email', type: dynamodb.AttributeType.STRING },
    });

    this.groupsTable = new dynamodb.Table(this, 'GroupsTable', {
      tableName: 'Kit2Fit-Groups',
      partitionKey: { name: 'groupId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    this.groupMembershipsTable = new dynamodb.Table(this, 'GroupMembershipsTable', {
      tableName: 'Kit2Fit-GroupMemberships',
      partitionKey: { name: 'groupId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    this.groupMembershipsTable.addGlobalSecondaryIndex({
      indexName: 'GSI1-UserGroups',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'groupId', type: dynamodb.AttributeType.STRING },
    });

    this.dailyLogsTable = new dynamodb.Table(this, 'DailyLogsTable', {
      tableName: 'Kit2Fit-DailyLogs',
      partitionKey: { name: 'groupIdUserId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'date', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    this.dailyLogsTable.addGlobalSecondaryIndex({
      indexName: 'GSI1-GroupDate',
      partitionKey: { name: 'groupId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'dateUserId', type: dynamodb.AttributeType.STRING },
    });

    this.adhocChallengesTable = new dynamodb.Table(this, 'AdhocChallengesTable', {
      tableName: 'Kit2Fit-AdhocChallenges',
      partitionKey: { name: 'groupId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'challengeId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const postConfirmationFn = new lambdaNode.NodejsFunction(this, 'PostConfirmationFn', {
      entry: 'src/handlers/auth/postConfirmation.ts',
      runtime: lambda.Runtime.NODEJS_20_X,
      environment: {
        USERS_TABLE: this.usersTable.tableName,
      },
    });
    this.usersTable.grantWriteData(postConfirmationFn);

    this.userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: 'Kit2Fit-UserPool',
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      standardAttributes: {
        fullname: { required: false, mutable: true },
        nickname: { required: false, mutable: true },
      },
      passwordPolicy: {
        minLength: 5,
        requireLowercase: true,
        requireUppercase: false,
        requireDigits: false,
        requireSymbols: false,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      lambdaTriggers: {
        postConfirmation: postConfirmationFn,
      },
    });

    this.userPoolClient = this.userPool.addClient('UserPoolClient', {
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
      generateSecret: false,
    });

    // --- S3 bucket for profile pictures ---
    const profilePicturesBucket = new s3.Bucket(this, 'ProfilePicturesBucket', {
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.PUT, s3.HttpMethods.GET],
          allowedOrigins: ['*'],
          allowedHeaders: ['*'],
        },
      ],
    });

    // --- Secrets ---
    const inviteLinkSecret = new secretsmanager.Secret(this, 'InviteLinkSecret', {
      secretName: 'kit2fit/invite-link-secret',
      generateSecretString: { excludePunctuation: true, passwordLength: 48 },
    });

    // --- Bedrock (LLM goal judge) ---
    const bedrockModelId = 'amazon.nova-micro-v1:0';
    const bedrockInvokePolicy = new iam.PolicyStatement({
      actions: ['bedrock:InvokeModel'],
      resources: [
        `arn:aws:bedrock:${this.region}::foundation-model/${bedrockModelId}`,
      ],
    });

    const tableEnv = {
      USERS_TABLE: this.usersTable.tableName,
      GROUPS_TABLE: this.groupsTable.tableName,
      GROUP_MEMBERSHIPS_TABLE: this.groupMembershipsTable.tableName,
      DAILY_LOGS_TABLE: this.dailyLogsTable.tableName,
      ADHOC_CHALLENGES_TABLE: this.adhocChallengesTable.tableName,
      PROFILE_PICTURES_BUCKET: profilePicturesBucket.bucketName,
    };

    const mkFn = (id: string, entry: string, extraEnv: Record<string, string> = {}) =>
      new lambdaNode.NodejsFunction(this, id, {
        entry,
        runtime: lambda.Runtime.NODEJS_20_X,
        timeout: cdk.Duration.seconds(15),
        bundling: { sourceMap: false },
        environment: { ...tableEnv, ...extraEnv },
      });

    // --- Users domain ---
    const getMeFn = mkFn('GetMeFn', 'src/handlers/users/getMe.ts');
    this.usersTable.grantReadData(getMeFn);
    profilePicturesBucket.grantRead(getMeFn);

    const updateMeFn = mkFn('UpdateMeFn', 'src/handlers/users/updateMe.ts');
    this.usersTable.grantReadWriteData(updateMeFn);

    const getProfilePictureUploadUrlFn = mkFn(
      'GetProfilePictureUploadUrlFn',
      'src/handlers/users/getProfilePictureUploadUrl.ts',
    );
    profilePicturesBucket.grantPut(getProfilePictureUploadUrlFn);

    const getMyProgressFn = mkFn('GetMyProgressFn', 'src/handlers/users/getMyProgress.ts');
    this.groupMembershipsTable.grantReadData(getMyProgressFn);
    this.groupsTable.grantReadData(getMyProgressFn);
    this.dailyLogsTable.grantReadData(getMyProgressFn);

    // --- Groups domain ---
    const createGroupFn = mkFn('CreateGroupFn', 'src/handlers/groups/createGroup.ts');
    this.groupsTable.grantWriteData(createGroupFn);
    this.groupMembershipsTable.grantWriteData(createGroupFn);

    const listMyGroupsFn = mkFn('ListMyGroupsFn', 'src/handlers/groups/listMyGroups.ts');
    this.groupMembershipsTable.grantReadData(listMyGroupsFn);
    this.groupsTable.grantReadData(listMyGroupsFn);

    const getGroupFn = mkFn('GetGroupFn', 'src/handlers/groups/getGroup.ts');
    this.groupsTable.grantReadData(getGroupFn);
    this.groupMembershipsTable.grantReadData(getGroupFn);

    const updateGroupFn = mkFn('UpdateGroupFn', 'src/handlers/groups/updateGroup.ts');
    this.groupsTable.grantReadWriteData(updateGroupFn);
    this.groupMembershipsTable.grantReadData(updateGroupFn);

    const addMemberFn = mkFn('AddMemberFn', 'src/handlers/groups/addMember.ts');
    this.groupMembershipsTable.grantReadWriteData(addMemberFn);
    this.usersTable.grantReadData(addMemberFn);

    const removeMemberFn = mkFn('RemoveMemberFn', 'src/handlers/groups/removeMember.ts');
    this.groupMembershipsTable.grantReadWriteData(removeMemberFn);
    this.groupsTable.grantReadData(removeMemberFn);

    const updateMemberGoalFn = mkFn(
      'UpdateMemberGoalFn',
      'src/handlers/groups/updateMemberGoal.ts',
    );
    this.groupMembershipsTable.grantReadWriteData(updateMemberGoalFn);
    this.groupsTable.grantReadData(updateMemberGoalFn);

    const completeOnboardingFn = mkFn(
      'CompleteOnboardingFn',
      'src/handlers/groups/completeOnboarding.ts',
    );
    this.groupMembershipsTable.grantReadWriteData(completeOnboardingFn);

    const createInviteLinkFn = mkFn(
      'CreateInviteLinkFn',
      'src/handlers/groups/createInviteLink.ts',
      { INVITE_LINK_SECRET_ARN: inviteLinkSecret.secretArn },
    );
    this.groupMembershipsTable.grantReadData(createInviteLinkFn);
    inviteLinkSecret.grantRead(createInviteLinkFn);

    const joinViaInviteFn = mkFn('JoinViaInviteFn', 'src/handlers/groups/joinViaInvite.ts', {
      INVITE_LINK_SECRET_ARN: inviteLinkSecret.secretArn,
    });
    this.groupsTable.grantReadData(joinViaInviteFn);
    this.groupMembershipsTable.grantReadWriteData(joinViaInviteFn);
    inviteLinkSecret.grantRead(joinViaInviteFn);

    // --- Logs domain ---
    const createLogFn = mkFn('CreateLogFn', 'src/handlers/logs/createLog.ts', {
      BEDROCK_MODEL_ID: bedrockModelId,
    });
    this.dailyLogsTable.grantReadWriteData(createLogFn);
    this.groupMembershipsTable.grantReadWriteData(createLogFn);
    this.adhocChallengesTable.grantReadData(createLogFn);
    createLogFn.addToRolePolicy(bedrockInvokePolicy);

    const listMyLogsFn = mkFn('ListMyLogsFn', 'src/handlers/logs/listMyLogs.ts');
    this.dailyLogsTable.grantReadData(listMyLogsFn);

    const updateLogFn = mkFn('UpdateLogFn', 'src/handlers/logs/updateLog.ts', {
      BEDROCK_MODEL_ID: bedrockModelId,
    });
    this.dailyLogsTable.grantReadWriteData(updateLogFn);
    this.groupMembershipsTable.grantReadWriteData(updateLogFn);
    this.adhocChallengesTable.grantReadData(updateLogFn);
    updateLogFn.addToRolePolicy(bedrockInvokePolicy);

    // --- Ad-hoc challenges domain ---
    const createChallengeFn = mkFn(
      'CreateChallengeFn',
      'src/handlers/challenges/createChallenge.ts',
    );
    this.adhocChallengesTable.grantWriteData(createChallengeFn);
    this.groupMembershipsTable.grantReadData(createChallengeFn);

    const listChallengesFn = mkFn('ListChallengesFn', 'src/handlers/challenges/listChallenges.ts');
    this.adhocChallengesTable.grantReadData(listChallengesFn);
    this.groupMembershipsTable.grantReadData(listChallengesFn);

    const deleteChallengeFn = mkFn(
      'DeleteChallengeFn',
      'src/handlers/challenges/deleteChallenge.ts',
    );
    this.adhocChallengesTable.grantWriteData(deleteChallengeFn);
    this.groupMembershipsTable.grantReadData(deleteChallengeFn);

    // --- Dashboard domain ---
    const getLeaderboardFn = mkFn('GetLeaderboardFn', 'src/handlers/dashboard/getLeaderboard.ts');
    this.groupMembershipsTable.grantReadData(getLeaderboardFn);
    this.usersTable.grantReadData(getLeaderboardFn);

    const getProgressFn = mkFn('GetProgressFn', 'src/handlers/dashboard/getProgress.ts');
    this.dailyLogsTable.grantReadData(getProgressFn);
    this.groupMembershipsTable.grantReadData(getProgressFn);
    this.usersTable.grantReadData(getProgressFn);

    // --- API Gateway ---
    const api = new apigateway.RestApi(this, 'Kit2FitApi', {
      restApiName: 'Kit2Fit API',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization'],
      },
    });

    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'Authorizer', {
      cognitoUserPools: [this.userPool],
    });

    const withAuth = { authorizer, authorizationType: apigateway.AuthorizationType.COGNITO };

    const users = api.root.addResource('users');
    const me = users.addResource('me');
    me.addMethod('GET', new apigateway.LambdaIntegration(getMeFn), withAuth);
    me.addMethod('PUT', new apigateway.LambdaIntegration(updateMeFn), withAuth);
    me.addResource('progress').addMethod('GET', new apigateway.LambdaIntegration(getMyProgressFn), withAuth);
    me.addResource('profile-picture-upload-url').addMethod(
      'POST',
      new apigateway.LambdaIntegration(getProfilePictureUploadUrlFn),
      withAuth,
    );

    const groups = api.root.addResource('groups');
    groups.addMethod('POST', new apigateway.LambdaIntegration(createGroupFn), withAuth);
    groups.addResource('mine').addMethod('GET', new apigateway.LambdaIntegration(listMyGroupsFn), withAuth);
    groups.addResource('join').addMethod('POST', new apigateway.LambdaIntegration(joinViaInviteFn), withAuth);

    const group = groups.addResource('{groupId}');
    group.addMethod('GET', new apigateway.LambdaIntegration(getGroupFn), withAuth);
    group.addMethod('PUT', new apigateway.LambdaIntegration(updateGroupFn), withAuth);

    const members = group.addResource('members');
    members.addMethod('POST', new apigateway.LambdaIntegration(addMemberFn), withAuth);
    const member = members.addResource('{userId}');
    member.addMethod('DELETE', new apigateway.LambdaIntegration(removeMemberFn), withAuth);
    member.addResource('goal').addMethod('PUT', new apigateway.LambdaIntegration(updateMemberGoalFn), withAuth);
    member
      .addResource('onboarding')
      .addMethod('PUT', new apigateway.LambdaIntegration(completeOnboardingFn), withAuth);

    group.addResource('invite-link').addMethod(
      'POST',
      new apigateway.LambdaIntegration(createInviteLinkFn),
      withAuth,
    );

    const logs = group.addResource('logs');
    logs.addMethod('POST', new apigateway.LambdaIntegration(createLogFn), withAuth);
    const logsMe = logs.addResource('me');
    logsMe.addMethod('GET', new apigateway.LambdaIntegration(listMyLogsFn), withAuth);
    logs.addResource('{date}').addMethod('PUT', new apigateway.LambdaIntegration(updateLogFn), withAuth);

    const challenges = group.addResource('challenges');
    challenges.addMethod('POST', new apigateway.LambdaIntegration(createChallengeFn), withAuth);
    challenges.addMethod('GET', new apigateway.LambdaIntegration(listChallengesFn), withAuth);
    challenges
      .addResource('{challengeId}')
      .addMethod('DELETE', new apigateway.LambdaIntegration(deleteChallengeFn), withAuth);

    const dashboard = group.addResource('dashboard');
    dashboard
      .addResource('leaderboard')
      .addMethod('GET', new apigateway.LambdaIntegration(getLeaderboardFn), withAuth);
    dashboard
      .addResource('progress')
      .addMethod('GET', new apigateway.LambdaIntegration(getProgressFn), withAuth);

    new cdk.CfnOutput(this, 'ApiUrl', { value: api.url });
    new cdk.CfnOutput(this, 'UserPoolId', { value: this.userPool.userPoolId });
    new cdk.CfnOutput(this, 'UserPoolClientId', { value: this.userPoolClient.userPoolClientId });
    new cdk.CfnOutput(this, 'ProfilePicturesBucketName', { value: profilePicturesBucket.bucketName });
  }
}
