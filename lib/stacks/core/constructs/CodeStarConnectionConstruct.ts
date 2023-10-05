// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import * as pipelines from 'aws-cdk-lib/pipelines';
import { Construct } from 'constructs';
import { ICodeStarConfig } from '../../../../config/Types';

export class CodeStarConnectionConstruct extends Construct {
  readonly pipelineInput: pipelines.IFileSetProducer;
  readonly codeStarConnectionArn: string;

  constructor(scope: Construct, id: string, props: ICodeStarConfig) {
    super(scope, id);

    this.pipelineInput = pipelines.CodePipelineSource.connection(props.name, props.branch, {
      connectionArn: props.codeStarConnectionArn,
    });
    this.codeStarConnectionArn =props.codeStarConnectionArn;
  }
}