// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import * as kms from 'aws-cdk-lib/aws-kms';
import { TestAppConfig } from './TestConfig';
import { STAGE } from '../config/Types';
import { S3BucketStack } from '../lib/stacks/app/S3BucketStack';


describe('s3-bucket-stack-test', () => {

  const app = new cdk.App();
  const stage = new cdk.Stage(app, 'TestState', { env: { region: TestAppConfig.region, account: TestAppConfig.deploymentAccounts.RES } });
  const testStack = new cdk.Stack(stage, 'KMSStack');
  const kmsKey = new kms.Key(testStack, 'Key');
  new S3BucketStack(stage, 'S3BucketStack', {
    bucketName: 'test-bucket',
    stageName: STAGE.RES,
    applicationQualifier: TestAppConfig.applicationQualifier,
    encryptionKey: kmsKey,
  });

  const { stacks } = stage.synth();
  const s3Template = Template.fromJSON(stacks[1].template);

  test('Check if S3 bucket exists', () => {
    s3Template.resourceCountIs('AWS::S3::Bucket', 1);
    s3Template.hasResourceProperties('AWS::S3::Bucket', {
      BucketName: `test-bucket-${TestAppConfig.applicationQualifier}-${STAGE.RES.toLowerCase()}-${TestAppConfig.region}-${TestAppConfig.deploymentAccounts.RES}`,
    });
  });

  test('Check if S3 bucket retain policy exists', () => {
    const bucket = Object.values(s3Template.findResources('AWS::S3::Bucket'))[0];
    expect(bucket.DeletionPolicy).toBe('Delete');
  });

  test('Check if KMS encryption exists', () => {
    const keyOutput: any = Object.values(stacks[0].template.Outputs)[0];

    s3Template.hasResourceProperties('AWS::S3::Bucket', {
      BucketEncryption: {
        ServerSideEncryptionConfiguration: [
          {
            ServerSideEncryptionByDefault: {
              KMSMasterKeyID: { 'Fn::ImportValue': keyOutput.Export.Name },
              SSEAlgorithm: 'aws:kms',
            },
          },
        ],
      },
    });
  });
});