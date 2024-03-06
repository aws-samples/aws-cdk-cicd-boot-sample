// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NagSuppressions } from 'cdk-nag';
import { Construct } from 'constructs';
import { PythonLambdaLayer } from './constructs/PythonLambdaLayer';

interface Props extends cdk.StackProps {
  stageName: string;
  applicationName: string;
}

export class LambdaStack extends cdk.Stack {

  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id, props);

    const layers:lambda.LayerVersion[] = !process.env.DISABLE_LAMBDA_LAYERS ? [
      new PythonLambdaLayer(this, 'CommonLambdaLayer', {
        folderPath: 'src/lambda-layer/common',
        description: 'Common lambda layer for OpenSSL, Confluent-Kafka, Pandas',
      }),
    ] : [];

    const testFunction = new lambda.Function(this, 'Function', {
      functionName: `${props.applicationName}-${props.stageName}-test-lambda`,
      runtime: lambda.Runtime.PYTHON_3_12,
      code: lambda.Code.fromAsset('src/lambda-functions/test'),
      handler: 'test-lambda.lambda_handler',
      layers: [...layers],
    });

    NagSuppressions.addResourceSuppressions(
      testFunction, [{
        id: 'AwsSolutions-IAM4',
        reason: 'Suppress AwsSolutions-IAM4 approved managed policies',
        appliesTo: [
          {
            regex: '/(.*)(AWSLambdaBasicExecutionRole)(.*)$/g',
          },
        ],
      }], true);
  };
}
