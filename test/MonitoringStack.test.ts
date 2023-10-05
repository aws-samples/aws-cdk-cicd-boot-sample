// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { TestAppConfig } from './TestConfig';
import { STAGE } from '../config/Types';
import { MonitoringStack } from '../lib/stacks/app/MonitoringStack';


describe('monitoring-stack-test', () => {
  const app = new cdk.App();

  const template = Template.fromStack(
    new MonitoringStack(app, 'MonitoringStack', {
      stageName: STAGE.RES,
      applicationName: TestAppConfig.applicationName,
      applicationQualifier: TestAppConfig.applicationQualifier,
    }));


  test('Check if KMS key exists', () => {
    template.resourceCountIs('AWS::KMS::Key', 1);
    template.hasResourceProperties('AWS::KMS::Key', {
      EnableKeyRotation: true,
    });

    template.resourceCountIs('AWS::KMS::Alias', 1);
    template.hasResourceProperties('AWS::KMS::Alias', {
      AliasName: `alias/${TestAppConfig.applicationName}-${STAGE.RES}-Monitoring-key`,
    });
  });


  test('Check if SNS topic exists', () => {
    template.resourceCountIs('AWS::SNS::TopicPolicy', 1);
    template.resourceCountIs('AWS::SNS::Topic', 1);
  });

  test('Check if dashboards exist', () => {
    template.resourceCountIs('AWS::CloudWatch::Dashboard', 2);
    template.hasResourceProperties('AWS::CloudWatch::Dashboard', {
      DashboardName: `CICDBoot-${STAGE.RES}`,
    });
    template.hasResourceProperties('AWS::CloudWatch::Dashboard', {
      DashboardName: `CICDBoot-${STAGE.RES}-Alarms`,
    });
  });
});