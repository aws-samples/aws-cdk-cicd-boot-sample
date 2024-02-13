// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import * as cdk from 'aws-cdk-lib';
import { AwsSolutionsChecks } from 'cdk-nag';
import { Construct } from 'constructs';
import { SecurityControls } from '../../../bin/aspects';
import { STAGE } from '../../../config/Types';
import { NagUtils } from '../../../utils/suppressions';
import { LambdaStack } from '../../stacks/app/LambdaStack';
import { MonitoringStack } from '../../stacks/app/MonitoringStack';
import { S3BucketStack } from '../../stacks/app/S3BucketStack';
import { ComplianceLogBucketStack } from '../../stacks/core/ComplianceLogBucketStack';
import { EncryptionStack } from '../../stacks/core/EncryptionStack';
import { LogRetentionRoleStack } from '../../stacks/core/LogRetentionRoleStack';

interface Props extends cdk.StageProps {
  applicationName: string;
  applicationQualifier: string;
  logRetentionInDays: string;
  resAccount: string;
  stage: STAGE;
  complianceLogBucketName: string;
}

export class AppStage extends cdk.Stage {

  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id, props);

    const encryptionStack = new EncryptionStack(this, `${props.applicationName}EncryptionStack`, {
      applicationName: props.applicationName,
      stageName: props.stage,
    });

    new ComplianceLogBucketStack(this, `${props.applicationName}ComplianceLogBucketStack`, {
      complianceLogBucketName: props.complianceLogBucketName,
    });

    new LogRetentionRoleStack(this, `${props.applicationName}LogRetentionRoleStack`, {
      resAccount: props.resAccount,
      stageName: props.stage,
      applicationName: props.applicationName,
    });

    new LambdaStack(this, `${props.applicationName}LambdaStack`, {
      stageName: props.stage,
      applicationName: props.applicationName,
    });

    new S3BucketStack(this, `${props.applicationName}S3Stack`, {
      bucketName: 'test-bucket',
      stageName: props.stage,
      applicationQualifier: props.applicationQualifier,
      encryptionKey: encryptionStack.kmsKey,
    });

    new MonitoringStack(this, `${props.applicationName}MonitoringStack`, {
      applicationName: props.applicationName,
      applicationQualifier: props.applicationQualifier,
      stageName: props.stage,
    });

    cdk.Aspects.of(this).add(
      new SecurityControls(
        encryptionStack.kmsKey,
        props.stage,
        props.logRetentionInDays,
        props.complianceLogBucketName,
      ),
    );
    cdk.Aspects.of(this).add(new AwsSolutionsChecks({ verbose: false }));
    NagUtils.addSuppressions(this);
  }

  static getLogRetentionRoleArn(account: string, region: string, stageName: STAGE, applicationName: string) {
    return LogRetentionRoleStack.getRoleArn(account, region, stageName, applicationName);
  }
}
