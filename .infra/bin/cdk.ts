#!/usr/bin/env node

import * as cdk from 'aws-cdk-lib';
import { MyStack } from '../lib/cdk-stack';

const app = new cdk.App();

new MyStack(app, 'MyStack', {
  env: { region: 'ap-northeast-1' },
});
