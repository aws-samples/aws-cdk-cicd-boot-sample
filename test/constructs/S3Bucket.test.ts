// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import * as kms from 'aws-cdk-lib/aws-kms';
import { STAGE } from '../../config/Types';
import { S3Bucket } from '../../lib/cdk-pipeline/core/S3Bucket';
import { TestAppConfig } from '../TestConfig';


describe('s3-bucket-construct-test', () => {
  const app = new cdk.App();
  const testStack = new cdk.Stack(app, 'S3ConstructTestStack', { env: { region: TestAppConfig.region, account: TestAppConfig.deploymentAccounts.RES } });
  const kmsKey = new kms.Key(testStack, 'Key');

  new S3Bucket(testStack, 'TestBucket', {
    bucketName: 'test-bucket',
    stageName: STAGE.RES,
    applicationQualifier: TestAppConfig.applicationQualifier,
    encryptionKey: kmsKey,
  });

  const template = Template.fromStack(testStack);

  test('Check if S3 bucket exists', () => {
    template.resourceCountIs('AWS::S3::Bucket', 1);
    template.hasResourceProperties('AWS::S3::Bucket', {
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
    });
  });

  test('Check if S3 bucket name exists', () => {
    template.hasResourceProperties('AWS::S3::Bucket', {
      BucketName: `test-bucket-${TestAppConfig.applicationQualifier}-${STAGE.RES.toLowerCase()}-${TestAppConfig.region}-${TestAppConfig.deploymentAccounts.RES}`,
    });
  });

  test('Check if KMS encryption exists', () => {
    const keyId: string = Object.keys(template.findResources('AWS::KMS::Key'))[0];

    template.hasResourceProperties('AWS::S3::Bucket', {
      BucketEncryption: {
        ServerSideEncryptionConfiguration: [
          {
            BucketKeyEnabled: true,
            ServerSideEncryptionByDefault: {
              KMSMasterKeyID: { 'Fn::GetAtt': [keyId, 'Arn'] },
              SSEAlgorithm: 'aws:kms',
            },
          },
        ],
      },
    });
  });
});