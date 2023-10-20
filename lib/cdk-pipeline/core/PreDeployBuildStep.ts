// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import * as pipelines from 'aws-cdk-lib/pipelines';
import { CDKPipeline } from './CDKPipeline';
import { STAGE } from '../../../config/Types';

export class PreDeployBuildStep extends pipelines.CodeBuildStep {
  private stage: STAGE;

  constructor(stage: STAGE, props: Omit<pipelines.CodeBuildStepProps, 'commands'>) {
    super(`PreDeploy${stage}`, {
      ...props,
      env: {
        ...props.env,
        STAGE: stage,
      },
      commands: [
        ...CDKPipeline.installCommands,
        'python src/codebuild/pre-deploy-test.py',
      ],
    });
    this.stage = stage;
  }

  public appendManualApprovalStep(): pipelines.ManualApprovalStep {
    // append a pipelines.ManualApprovalStep AFTER the prebuild step and return it
    const manualApprovalStep = new pipelines.ManualApprovalStep(`PromoteTo${this.stage}`);
    manualApprovalStep.addStepDependency(this);
    return manualApprovalStep;
  }
}
