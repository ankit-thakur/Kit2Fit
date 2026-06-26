#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { Kit2FitStack } from '../lib/kit2fit-stack';

const app = new cdk.App();
new Kit2FitStack(app, 'Kit2FitStack', {
  description: 'Kit2Fit fitness challenge app backend',
});
