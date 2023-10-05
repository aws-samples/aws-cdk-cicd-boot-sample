// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import { NagSuppressions } from 'cdk-nag';
import { Construct } from 'constructs';
import { STAGE } from '../../../config/Types';

interface Props extends cdk.StackProps {
  resAccount: string;
  stageName: STAGE;
  applicationName: string;
}

export class LogRetentionRoleStack extends cdk.Stack {

  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id, props);

    const role = new iam.Role(this, 'Role', {
      roleName: LogRetentionRoleStack.getRoleName(this.account, this.region, props.stageName, props.applicationName),
      assumedBy: new iam.AccountPrincipal(props.resAccount),
      inlinePolicies: {
        logRetentionOperation: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'logs:PutRetentionPolicy',
                'logs:CreateLogGroup',
                'logs:CreateLogStream',
                'logs:PutLogEvents',
                'logs:GetLogEvents',
                'logs:AssociateKmsKey',
                'logs:Describe*',
                'kms:Encrypt',
                'kms:Decrypt',
                'kms:ReEncrypt',
                'kms:GenerateDataKey',
                'kms:DescribeKey',
                'cloudformation:Get*',
                'cloudformation:Describe*',
                'cloudformation:List*',
              ],
              resources: [
                '*',
              ],
            }),
          ],
        }),
      },
    });

    new cdk.CfnOutput(this, 'RoleArnCfnOutput', {
      value: role.roleArn,
    });

    NagSuppressions.addResourceSuppressions(role, [{
      id: 'AwsSolutions-IAM5',
      reason: 'This is default IAM role for lambda function. Suppress this warning.',
    }],
    true,
    );
  }

  static getRoleName(account:string, region:string, stageName: STAGE, applicationName: string) {
    return `log-retention-${account}-${region}-${applicationName}-${stageName}`;
  }

  static getRoleArn(account: string, region: string, stageName: STAGE, applicationName: string) {
    return cdk.Arn.format({
      partition: 'aws',
      service: 'iam',
      account,
      region: '',
      resource: 'role',
      resourceName: LogRetentionRoleStack.getRoleName(account, region, stageName, applicationName),
    });
  }
}
