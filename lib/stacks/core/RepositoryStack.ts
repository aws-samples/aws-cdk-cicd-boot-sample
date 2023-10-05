// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import * as cdk from 'aws-cdk-lib';
import * as pipelines from 'aws-cdk-lib/pipelines';
import { Construct } from 'constructs';
import { CodeCommitRepositoryConstruct } from './constructs/CodeCommitRepositoryConstruct';
import { CodeStarConnectionConstruct } from './constructs/CodeStarConnectionConstruct';
import { IRepositoryConfig } from '../../../config/Types';

interface RepositoryProps extends cdk.StackProps {
  applicationName: string;
  applicationQualifier: string;
  repositoryConfig: IRepositoryConfig;
}

export class RepositoryStack extends cdk.Stack {
  readonly pipelineInput: pipelines.IFileSetProducer;
  readonly pipelineEnvVars: {[key in string]: string};
  readonly repositoryBranch: string;

  constructor(scope: Construct, id: string, props: RepositoryProps) {
    super(scope, id, props);

    switch (props.repositoryConfig.selected) {
      case 'GITHUB': {
        const codeStarConnectionConstruct = new CodeStarConnectionConstruct(this, 'CodeStar', props.repositoryConfig.GITHUB);
        this.pipelineInput = codeStarConnectionConstruct.pipelineInput;
        this.repositoryBranch = props.repositoryConfig.GITHUB.branch;
        this.pipelineEnvVars = { CODESTAR_CONNECTION_ARN: codeStarConnectionConstruct.codeStarConnectionArn };
        break;
      }

      case 'CODECOMMIT': {
        this.pipelineInput = new CodeCommitRepositoryConstruct(this, 'CodeCommit', {
          applicationName: props.applicationName,
          applicationQualifier: props.applicationQualifier,
          ...props.repositoryConfig.CODECOMMIT,
        }).pipelineInput;
        this.repositoryBranch = props.repositoryConfig.CODECOMMIT.branch;
        this.pipelineEnvVars = {};
        break;
      }
    }
  }

}
