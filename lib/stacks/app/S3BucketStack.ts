// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import * as cdk from 'aws-cdk-lib';
import * as kms from 'aws-cdk-lib/aws-kms';
import { Construct } from 'constructs';
import { STAGE } from '../../../config/Types';
import { S3Bucket } from '../../cdk-pipeline/core/S3Bucket';

interface Props extends cdk.StackProps {
  bucketName: string;
  stageName: STAGE;
  applicationQualifier: string;
  encryptionKey: kms.IKey;
}

export class S3BucketStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id, props);

    new S3Bucket(this, 'S3Bucket', {
      applicationQualifier: props.applicationQualifier,
      stageName: props.stageName,
      bucketName: props.bucketName,
      encryptionKey: props.encryptionKey,
      removalPolicy: props.stageName == STAGE.PROD ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: props.stageName != STAGE.PROD,
    });
  };
}
