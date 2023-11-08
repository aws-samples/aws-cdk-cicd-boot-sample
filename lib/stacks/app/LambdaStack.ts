// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
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

    new lambda.Function(this, 'Function', {
      functionName: `${props.applicationName}-${props.stageName}-test-lambda`,
      runtime: lambda.Runtime.PYTHON_3_11,
      code: lambda.Code.fromAsset('src/lambda-functions/test'),
      handler: 'test-lambda.lambda_handler',
      layers: [...layers],
    });
  };
}
