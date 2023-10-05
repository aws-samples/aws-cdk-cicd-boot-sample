// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { TestAppConfig } from './TestConfig';
import { STAGE } from '../config/Types';
import { EncryptionStack } from '../lib/stacks/core/EncryptionStack';

describe('encryption-stack-test', () => {
  const app = new cdk.App();

  const template = Template.fromStack(
    new EncryptionStack(app, 'EncryptionStack', {
      env: { account: TestAppConfig.deploymentAccounts.RES, region: TestAppConfig.region },
      applicationName: TestAppConfig.applicationName,
      stageName: STAGE.RES,
    }));

  test('Check if KMS Key exists', () => {
    template.resourceCountIs('AWS::KMS::Key', 1);
    template.hasResourceProperties('AWS::KMS::Key', {
    });
  });

  test('Check if KMS Alias exists', () => {
    template.resourceCountIs('AWS::KMS::Alias', 1);
    template.hasResourceProperties('AWS::KMS::Alias', {
      AliasName: `alias/${TestAppConfig.applicationName}-${STAGE.RES}-key`,
    });
  });

  test('Check if Stack Output exists', () => {
    template.hasOutput('KeyArnCfnOutput', {
      Export: {
        Name: `${TestAppConfig.applicationName}-${STAGE.RES}-kms-key-arn`,
      },
    });
  });

});