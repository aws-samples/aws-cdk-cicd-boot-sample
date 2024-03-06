// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import * as cdk from 'aws-cdk-lib';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export interface S3BucketProps extends s3.BucketProps {
  readonly applicationQualifier: string;
  readonly stageName: string;
  readonly bucketName: string;
  readonly encryptionKey: kms.IKey;
}


export class S3Bucket extends s3.Bucket {
  constructor(scope: Construct, id: string, props: S3BucketProps) {
    const region = cdk.Stack.of(scope).region;
    const account = cdk.Stack.of(scope).account;

    super(scope, id, {
      ...props,
      bucketName: S3Bucket.getS3BucketName(props.bucketName, props.applicationQualifier, props.stageName, region, account),
      publicReadAccess: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: props.encryptionKey,
      bucketKeyEnabled: true,
      enforceSSL: true,
    });
  }

  static getS3BucketName(bucketName: string, applicationQualifier: string, stageName: string, region: string, account: string) {
    return `${bucketName}-${applicationQualifier}-${stageName}-${region}-${account}`.toLowerCase();
  }
}
