// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import { CodeGuruSecurityStep as CodeGuruSecurityStepConstruct, CodeGuruSeverityThreshold } from '../../lib/cdk-pipeline/core/constructs/CodeGuruSecurityStepConstruct';
import { TestAppConfig } from '../TestConfig';

describe('codeguru-step-construct', () => {
  const stack = new cdk.Stack();

  new CodeGuruSecurityStepConstruct(stack, 'CodeGuruReviewStep', {
    applicationQualifier: TestAppConfig.applicationQualifier,
    sourceOutput: new codepipeline.Artifact(),
    threshold: CodeGuruSeverityThreshold.HIGH,
  });

  const template = Template.fromStack(stack);

  test('Check if codebuild exists', () => {
    template.resourceCountIs('AWS::CodeBuild::Project', 1);
    template.hasResourceProperties('AWS::CodeBuild::Project', {
      Artifacts: {
        Type: 'CODEPIPELINE',
      },
      Environment: {
        Image: 'public.ecr.aws/l6c8c5q3/codegurusecurity-actions-public@sha256:1077986a48ec419f3bc72a2a321773f59c259632f0f9fb72b1a2067b12fd4311',
      },
      Name: `${TestAppConfig.applicationQualifier}CodeGuruSecurity`,
    });
  });

  test('Check if role exists', () => {
    template.resourceCountIs('AWS::IAM::Role', 1);
  });
});