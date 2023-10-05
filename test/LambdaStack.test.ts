// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { STAGE } from '../config/Types';
import { LambdaStack } from '../lib/stacks/app/LambdaStack';


describe('lambda-stack-test', () => {
  const app = new cdk.App();

  const template = Template.fromStack(
    new LambdaStack(app, 'LambdaStack', {
      stageName: STAGE.RES,
    }));

  test('Check if lambda exists', () => {
    template.resourceCountIs('AWS::Lambda::Function', 1);
    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: `${STAGE.RES}-test-lambda`,
      Runtime: 'python3.11',
    });
  });
});