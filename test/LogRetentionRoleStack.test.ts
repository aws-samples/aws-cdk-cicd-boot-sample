// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { TestAppConfig } from './TestConfig';
import { STAGE } from '../config/Types';
import { EncryptionStack } from '../lib/stacks/core/EncryptionStack';
import { LogRetentionRoleStack } from '../lib/stacks/core/LogRetentionRoleStack';


describe('log-retention-role-stack-test', () => {
  const app = new cdk.App();

  const encryptionStack = new EncryptionStack(app, 'EncryptionStack', {
    env: { account: TestAppConfig.deploymentAccounts.RES, region: TestAppConfig.region },
    applicationName: TestAppConfig.applicationName,
    stageName: STAGE.RES,
  });

  const template = Template.fromStack(
    new LogRetentionRoleStack(app, 'LogRetentionRoleStack', {
      env: { account: TestAppConfig.deploymentAccounts.RES, region: TestAppConfig.region },
      resAccount: TestAppConfig.deploymentAccounts.RES,
      stageName: STAGE.RES,
      applicationName: TestAppConfig.applicationName,
      encryptionKey: encryptionStack.kmsKey,
    }),
  );

  test('Check if role exists', () => {
    template.resourceCountIs('AWS::IAM::Role', 1);
    template.hasResourceProperties('AWS::IAM::Role', {
      AssumeRolePolicyDocument: { Statement: [{ Action: 'sts:AssumeRole', Effect: 'Allow' }] },
    });
  });

  test('Check if output exists', () => {
    const roleName = Object.keys(template.findResources('AWS::IAM::Role'))[0];
    template.hasOutput('RoleArnCfnOutput', {
      Value: { 'Fn::GetAtt': [roleName, 'Arn'] },
    });
  });
});
