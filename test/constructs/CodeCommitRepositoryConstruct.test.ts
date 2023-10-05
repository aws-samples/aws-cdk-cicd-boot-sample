// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { CodeCommitRepositoryConstruct } from '../../lib/stacks/core/constructs/CodeCommitRepositoryConstruct';
import { TestAppConfig } from '../TestConfig';

describe('codecommit-repository-construct', () => {
  const stack = new cdk.Stack();

  new CodeCommitRepositoryConstruct(stack, 'CodeCommit', {
    applicationName: TestAppConfig.applicationName,
    applicationQualifier: TestAppConfig.applicationQualifier,
    ...TestAppConfig.repositoryConfig.CODECOMMIT,
  });

  const template = Template.fromStack(stack);

  test('Check if CodeCommit repo exists', () => {
    template.resourceCountIs('AWS::CodeCommit::Repository', 1);
    template.hasResourceProperties('AWS::CodeCommit::Repository', {
      RepositoryName: TestAppConfig.repositoryConfig.CODECOMMIT.name,
    });
  });

  test('Check if CfnRepositoryAssociation exists', () => {
    template.resourceCountIs('AWS::CodeGuruReviewer::RepositoryAssociation', 1);
    template.hasResourceProperties('AWS::CodeGuruReviewer::RepositoryAssociation', {
      Type: 'CodeCommit',
    });
  });

  test('Check if ApprovalRuleTemplate exists', () => {
    template.resourceCountIs('Custom::ApprovalRuleTemplate', 1);
    template.hasResourceProperties('Custom::ApprovalRuleTemplate', {
      Template: {
        Approvers: {
          NumberOfApprovalsNeeded: 1,
        },
      },
    });
  });

  test('Check if ApprovalRuleTemplateRepositoryAssociation exists', () => {
    template.resourceCountIs('Custom::ApprovalRuleTemplateRepositoryAssociation', 1);
    template.hasResourceProperties('Custom::ApprovalRuleTemplateRepositoryAssociation', {
    });
  });

});