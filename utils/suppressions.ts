// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import * as nag from 'cdk-nag';
import { Construct } from 'constructs';

export class NagUtils {
  static readonly suppressions: nag.NagPackSuppression[] = [
    {
      id: 'AwsSolutions-IAM4',
      reason: 'Suppress AwsSolutions-IAM4 approved managed policies',
      appliesTo: [
        {
          regex: '/(.*)(AWSLambdaBasicExecutionRole)(.*)$/g',
        },
      ],
    },
  ];

  static addSuppressions(construct: Construct) {
    nag.NagSuppressions.addResourceSuppressions(construct, NagUtils.suppressions, true);
  }
}


