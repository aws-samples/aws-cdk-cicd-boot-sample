// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { AppStage } from '../../app/AppStage';
import { IStageProvider, Environment, DeploymentProviderProps, Deployment } from '../PipelineStack';
import { PostDeployBuildStep } from '../PostDeployBuildStep';
import { PreDeployBuildStep } from '../PreDeployBuildStep';

export class DefaultAppStageProvider implements IStageProvider {

  constructor(readonly environment: Environment, readonly manualApproval = false) { }

  provide(props: DeploymentProviderProps): Deployment {
    const logRetentionRoleArn = AppStage.getLogRetentionRoleArn(
      this.environment.account,
      this.environment.region,
      props.stage,
      props.applicationName,
    );

    const preDeployStep = new PreDeployBuildStep(props.stage, {
      env: {
        TARGET_REGION: this.environment.region,
      },
    });

    return {
      stage: new AppStage(props.scope, props.stage, {
        env: this.environment,
        resAccount: props.resAccount,
        applicationName: props.applicationName,
        applicationQualifier: props.applicationQualifier,
        logRetentionInDays: props.logRetentionInDays,
        stage: props.stage,
        complianceLogBucketName: props.complianceLogBucketName,
      }),
      preDeploySteps: [
        preDeployStep,
        // add manual approval step for all STAGE, except DEV
        ...(this.manualApproval ?
          [
            preDeployStep.appendManualApprovalStep(),
          ]
          : []
        ),
      ],
      postDeploySteps: [
        new PostDeployBuildStep(props.stage, {
          env: {
            ACCOUNT_ID: this.environment.account,
            TARGET_REGION: this.environment.region,
          },
        },
        props.applicationName,
        props.logRetentionInDays,
        logRetentionRoleArn,
        ),
      ],
    };
  }

}
