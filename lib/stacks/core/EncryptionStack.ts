// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as kms from 'aws-cdk-lib/aws-kms';
import { Construct } from 'constructs';

interface Props extends cdk.StackProps {
  applicationName: string;
  stageName: string;
}

export class EncryptionStack extends cdk.Stack {
  public readonly kmsKey: kms.Key;

  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id, props);

    this.kmsKey = new kms.Key(this, 'Key', {
      enableKeyRotation: true,
      alias: `${props.applicationName}-${props.stageName}-key`,
    });

    const keyStatement = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'kms:CancelKeyDeletion',
        'kms:CreateAlias',
        'kms:DeleteAlias',
        'kms:DisableKey',
        'kms:DisableKeyRotation',
        'kms:EnableKeyRotation',
        'kms:PutKeyPolicy',
        'kms:UpdateAlias',
        'kms:EnableKey',
        'kms:ScheduleKeyDeletion',
      ],
      resources: ['*'],
      principals: [
        new iam.AccountRootPrincipal(),
      ],
    });

    this.kmsKey.addToResourcePolicy(keyStatement);
    this.kmsKey.grantEncryptDecrypt(new iam.AccountRootPrincipal());
    this.kmsKey.grantEncryptDecrypt(new iam.ServicePrincipal(`logs.${this.region}.amazonaws.com`));

    new cdk.CfnOutput(this, 'KeyArnCfnOutput', {
      value: this.kmsKey.keyArn,
      description: 'The id of the main kms key',
      exportName: `${props.applicationName}-${props.stageName}-kms-key-arn`,
    });
  }
}