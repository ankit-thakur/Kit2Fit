# Environments: v1 and v2

Kit2Fit runs as two independent deployments in the same AWS account and region.
**v1 is frozen** — kept deployed so the original app can still be opened for a
demo or comparison — and **v2 is where all new work happens**.

The two share sign-in. They share nothing else.

For what v2 actually changes, see [v2-spec.md](./v2-spec.md).

---

## What is shared and what is not

| Resource | Physical name | Owner | v2 |
| --- | --- | --- | --- |
| Cognito user pool | `Kit2Fit-UserPool` | v1 stack | imports it, adds its own app client |
| Users table | `Kit2Fit-Users` | v1 stack | imports, reads and writes |
| Profile pictures bucket | *(CDK-generated)* | v1 stack | imports |
| Groups | `Kit2Fit-Groups` | v1 stack | **not shared** — `Kit2FitV2-Groups` |
| Memberships | `Kit2Fit-GroupMemberships` | v1 stack | **not shared** — `Kit2FitV2-GroupMemberships` |
| Daily logs | `Kit2Fit-DailyLogs` | v1 stack | **not shared** — replaced by Completions |
| Challenges | `Kit2Fit-AdhocChallenges` | v1 stack | **not shared** — replaced by Events |
| Pledges, Completions, WeekScores, Events, EventRsvps | — | — | new in v2 |
| Invite link secret | `kit2fit/invite-link-secret` | v1 stack | **not shared** — `kit2fit-v2/invite-link-secret` |
| Anthropic API key | `kit2fit/anthropic-api-key` | v1 stack | not used — v2 has no LLM judge |

### Why identity is shared

Members keep the accounts they already have, and their `userId` (the Cognito
`sub`) is identical in both apps, so profiles and photos carry across. The v1
`postConfirmation` trigger writes only identity fields — `userId`, `email`,
`phoneNumber`, `name`, `nickname`, `createdAt` — so it is already correct for v2
and needs no changes.

This does not couple v2's lifetime to v1's. The pool, Users table and bucket are
all `RemovalPolicy.RETAIN`, so they survive even if the v1 stack is deleted, and
v2's grants attach policies to **v2's own Lambda roles** rather than to the
imported resources — nothing in the v1 stack has to change to permit access.

### Why challenge data is not shared

v1 stores one goal per membership with `startingMetricValue` / `targetMetricValue`
and scores points from workout duration. v2 scores completions against a weekly
pledge target. There is no coherent mapping between them, so v2 starts with empty
groups; members join a new group and set pledges once.

Keeping v1's tables untouched also keeps the real two-month challenge data pristine
for demos.

---

## The rule that protects v1's data

**Never change a `tableName`, `secretName`, or construct id inside
`backend/lib/kit2fit-stack.ts`, and never change the `'Kit2FitStack'` id in
`backend/bin/kit2fit.ts`.**

CloudFormation treats a rename as a *replacement*: it creates a new resource and
removes the old one from the stack. Because every v1 table is
`RemovalPolicy.RETAIN`, the old table is not deleted — it is orphaned. The stack
then points at a brand-new empty table while two months of real data sits in a
table nothing references. The app would look like it had lost everything.

Before any v1 deploy, confirm nothing has drifted:

```bash
cd backend && npx cdk diff Kit2FitStack   # must report no changes
```

---

## Deploying

### v1 (rarely — ideally never again)

```bash
cd backend && npx cdk deploy Kit2FitStack
```

### v2

The v2 stack is only synthesised once the three shared identifiers are present in
`backend/cdk.json` context. Until they are, it is skipped with a warning and v1
deploys exactly as before.

Read them off the v1 stack's outputs:

```bash
aws cloudformation describe-stacks --stack-name Kit2FitStack \
  --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'||OutputKey=='ProfilePicturesBucketName']"
```

Then fill in `backend/cdk.json`:

```json
"sharedUserPoolId": "us-east-1_XXXXXXXXX",
"sharedUsersTableName": "Kit2Fit-Users",
"sharedProfilePicturesBucketName": "kit2fitstack-profilepicturesbucket-xxxxxxxx"
```

```bash
cd backend && npx cdk deploy Kit2FitV2Stack
```

---

## v2 key shapes

Composite string keys follow v1's convention.

| Table | PK | SK | GSI |
| --- | --- | --- | --- |
| `Kit2FitV2-Groups` | `groupId` | — | — |
| `Kit2FitV2-GroupMemberships` | `groupId` | `userId` | `GSI1-UserGroups`: `userId` / `groupId` |
| `Kit2FitV2-Pledges` | `groupIdUserId` | `pledgeId` | `GSI1-GroupPledges`: `groupId` / `userIdPledgeId` |
| `Kit2FitV2-Completions` | `groupIdUserId` | `datePledgeId` | `GSI1-GroupDate`: `groupId` / `dateUserId` |
| `Kit2FitV2-WeekScores` | `groupIdUserId` | `weekStart` | `GSI1-GroupWeek`: `groupId` / `weekStartUserId` |
| `Kit2FitV2-Events` | `groupId` | `eventId` | `GSI1-GroupStart`: `groupId` / `startsAt` |
| `Kit2FitV2-EventRsvps` | `eventId` | `userId` | — |

The Completions sort key is `` `${date}#${pledgeId}` ``. That makes **one
completion per pledge per day** a property of the primary key rather than a rule
handlers have to remember — write with
`ConditionExpression: 'attribute_not_exists(groupIdUserId)'` and a duplicate is
rejected by DynamoDB.

`GSI1-GroupDate` mirrors v1's daily-logs index, so the group board and standings
queries have the same shape they did before.

---

## Frontend

Both apps read the same environment variables, so v2 needs no frontend code
change — only a second deployment with different values:

| Variable | v1 | v2 |
| --- | --- | --- |
| `VITE_USER_POOL_ID` | shared pool | **same value** |
| `VITE_USER_POOL_CLIENT_ID` | v1 client | v2 client (`Kit2FitV2-Web`) |
| `VITE_API_URL` | v1 API | v2 API |

**Leave v1's frontend at its current URL.** `kit2fit-stack.ts` hardcodes
`APP_BASE_URL: 'https://kit2fit.pages.dev'` for invite links, so re-pointing v1
would break them and force a redeploy of the stack you are trying to freeze. Give
v2 a new URL instead.

---

## Cost of keeping v1 alive

Effectively nothing. DynamoDB is `PAY_PER_REQUEST` with no traffic, Lambda and API
Gateway are free at idle, S3 holds a handful of images, and Cognito is far below
the free tier. The only standing charge is **Secrets Manager at roughly
$0.40/secret/month — about $0.80/month** for v1's two secrets.

Worth doing once, so the demo data does not depend on the AWS account staying
healthy: dump the v1 tables to JSON and keep them somewhere else.

```bash
for t in Users Groups GroupMemberships DailyLogs AdhocChallenges; do
  aws dynamodb scan --table-name "Kit2Fit-$t" > "v1-backup-$t.json"
done
```
