// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { TestAppConfig } from './TestConfig';
import { SSMParameterStack } from '../lib/stacks/core/SSMParameterStack';


describe('ssm-parameter-stack-test', () => {
  const app = new cdk.App();
  const template = Template.fromStack(
    new SSMParameterStack(app, 'SSMParameterStack', {
      env: { account: TestAppConfig.deploymentAccounts.RES, region: TestAppConfig.region },
      applicationQualifier: TestAppConfig.applicationQualifier,
      parameter: {
        AccountRes: TestAppConfig.deploymentAccounts.RES,
        AccountDev: TestAppConfig.deploymentAccounts.DEV,
        AccountInt: TestAppConfig.deploymentAccounts.INT,
      },
    }));

  test('Check if Parameters exist', () => {
    template.resourceCountIs('AWS::SSM::Parameter', 3);
    template.hasResourceProperties('AWS::SSM::Parameter', {
      Name: `/${TestAppConfig.applicationQualifier}/AccountRes`,
      Value: TestAppConfig.deploymentAccounts.RES,
      Type: 'String',
    });

    template.hasResourceProperties('AWS::SSM::Parameter', {
      Name: `/${TestAppConfig.applicationQualifier}/AccountDev`,
      Value: TestAppConfig.deploymentAccounts.DEV,
      Type: 'String',
    });

    template.hasResourceProperties('AWS::SSM::Parameter', {
      Name: `/${TestAppConfig.applicationQualifier}/AccountInt`,
      Value: TestAppConfig.deploymentAccounts.INT,
      Type: 'String',
    });
  });
});