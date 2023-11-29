// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { TestAppConfig } from './TestConfig';
import { RepositoryStack } from '../lib/stacks/core/RepositoryStack';

describe('repository-stack-test-codecommit', () => {
  const app = new cdk.App();
  const template = Template.fromStack(
    new RepositoryStack(app, 'RepositoryStackCodeCommit', {
      env: { account: TestAppConfig.deploymentAccounts.RES, region: TestAppConfig.region },
      applicationName: TestAppConfig.applicationName,
      applicationQualifier: TestAppConfig.applicationQualifier,
      repositoryConfig: {
        ...TestAppConfig.repositoryConfig,
        selected: 'CODECOMMIT',
      },
    }));

  test('Check if CodeCommitRepository construct present', () => {
    template.resourceCountIs('AWS::CodeCommit::Repository', 1);
    template.hasResourceProperties('AWS::CodeCommit::Repository', {
      RepositoryName: TestAppConfig.repositoryConfig.CODECOMMIT.name,
    });
  });

});

describe('repository-stack-test-codestarconnect', () => {
  const app = new cdk.App();
  const stack = new RepositoryStack(app, 'RepositoryStackCodeStar', {
    env: { account: TestAppConfig.deploymentAccounts.RES, region: TestAppConfig.region },
    applicationName: TestAppConfig.applicationName,
    applicationQualifier: TestAppConfig.applicationQualifier,
    repositoryConfig: {
      ...TestAppConfig.repositoryConfig,
      selected: 'GITHUB',
    },
  });

  const template = Template.fromStack(stack);
  test('Check if resources should not exist', () => {
    expect(template.toJSON()).not.toHaveProperty('Resources');
  });

});