// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';

type Parameter = 'AccountRes' | 'AccountDev' | 'AccountInt' | string;

interface Props extends cdk.StackProps {
  applicationQualifier: string;
  parameter?: {
    [key in Parameter]: string;
  };
}

export class SSMParameterStack extends cdk.Stack {
  private static instance: SSMParameterStack;

  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id, props);

    SSMParameterStack.instance = this;

    if (props.parameter) {
      Object.entries(props.parameter!).forEach(([parameterName, parameterValue]) => {
        SSMParameterStack.createParameter(this, props.applicationQualifier, parameterName, parameterValue);
      });
    }
  }

  static createParameterInSSMParameterStack(applicationQualifier: string, parameterName: string, parameterValue: string) {
    return new ssm.StringParameter(SSMParameterStack.instance, `${parameterName}Parameter`, {
      parameterName: `/${applicationQualifier}/${parameterName}`,
      stringValue: parameterValue,
    });
  }

  static createParameter(scope: Construct, applicationQualifier: string, parameterName: string, parameterValue: string) {
    return new ssm.StringParameter(scope, `${parameterName}Parameter`, {
      parameterName: `/${applicationQualifier}/${parameterName}`,
      stringValue: parameterValue,
    });
  }

  static getGetParameterPolicyStatement(account: string, region: string, applicationQualifier: string): iam.PolicyStatement {
    const parameterArn: string = cdk.Arn.format({
      partition: 'aws',
      service: 'ssm',
      region,
      account,
      resource: 'parameter',
      resourceName: `${applicationQualifier}/*`,
    });
    return new iam.PolicyStatement({
      actions: [
        'ssm:GetParameter',
        'ssm:GetParameters',
        'ssm:GetParametersByPath',
      ],
      resources: [parameterArn],
    });
  }
}
