// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { TestAppConfig } from './TestConfig';
import { ComplianceLogBucketStack } from '../lib/stacks/core/ComplianceLogBucketStack';

describe('encryption-stack-test', () => {
  const app = new cdk.App();

  const template = Template.fromStack(
    new ComplianceLogBucketStack(app, 'EncryptionStack', {
      complianceLogBucketName: TestAppConfig.complianceLogBucketName.RES,
    }));

  test('Check if Lambda Function exists', () => {
    template.resourceCountIs('AWS::Lambda::Function', 2);
    template.hasResourceProperties('AWS::Lambda::Function', {
      Handler: 'make-compliance-log-bucket.handler',
      Runtime: 'python3.12',
    });
  });

  test('Check if Custom Resource exists', () => {
    template.resourceCountIs('AWS::CloudFormation::CustomResource', 1);
  });

});