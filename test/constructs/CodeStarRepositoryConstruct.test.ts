// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { CodeStarConnectionConstruct } from '../../lib/stacks/core/constructs/CodeStarConnectionConstruct';
import { TestAppConfig } from '../TestConfig';

describe('codestar-connect-repository-construct', () => {
  const stack = new cdk.Stack();

  new CodeStarConnectionConstruct(stack, 'CodeStarConnection', {
    ...TestAppConfig.repositoryConfig.GITHUB,
  });

  const template = Template.fromStack(stack);

  test('Check if resources should not exists', () => {
    expect(template.toJSON()).not.toHaveProperty('Resources');
  });

  test('Check if CodeCommit repo should not exists', () => {
    template.resourceCountIs('AWS::CodeCommit::Repository', 0);
  });

  test('Check if CodeGuru Review should not exists', () => {
    template.resourceCountIs('AWS::CodeGuruReviewer::RepositoryAssociation', 0);
  });

  test('Check if ApprovalRuleTemplate should not exists', () => {
    template.resourceCountIs('Custom::ApprovalRuleTemplate', 0);
  });

});
