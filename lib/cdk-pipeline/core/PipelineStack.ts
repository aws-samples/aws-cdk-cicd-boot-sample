// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import * as cdk from 'aws-cdk-lib';
import * as codecommit from 'aws-cdk-lib/aws-codecommit';
import * as iam from 'aws-cdk-lib/aws-iam';
import { NagSuppressions } from 'cdk-nag';
import { Construct } from 'constructs';
import { CDKPipeline, PipelineProps } from './CDKPipeline';
import { PostDeployBuildStep } from './PostDeployBuildStep';
import { PreDeployBuildStep } from './PreDeployBuildStep';
import { DeploymentStage, STAGE } from '../../../config/Types';
import { SSMParameterStack } from '../../stacks/core/SSMParameterStack';
import { AppStage } from '../app/AppStage';

export interface RepositoryProps extends codecommit.RepositoryProps {
  readonly connectionArn: string;
}

interface Props extends cdk.StackProps {
  applicationName: string;
  applicationQualifier: string;
  logRetentionInDays: string;
  deployments: {[key in DeploymentStage]: Environment};
  pipelineProps: PipelineProps;
  complianceLogBucketName: {[key in DeploymentStage]: string};
}

interface Environment {
  account: string;
  region: string;
}
export class PipelineStack extends cdk.Stack {
  readonly codecommitRepositoryName: string;

  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id, props);

    const pipeline = new CDKPipeline(this, 'CdkPipeline', {
      ...props.pipelineProps,
      applicationQualifier: props.applicationQualifier,
      pipelineName: props.applicationName,
      rolePolicies: [
        ...(props.pipelineProps.vpcProps?.proxy?.proxySecretArn ?
          [new iam.PolicyStatement({
            actions: [
              'secretsmanager:GetSecretValue',
            ],
            resources: [props.pipelineProps.vpcProps.proxy.proxySecretArn],
          })] : []),
        SSMParameterStack.getGetParameterPolicyStatement(this.account, this.region, props.applicationQualifier),
      ],
    });

    Object.entries(props.deployments).forEach(([deploymentStage, deploymentEnvironment]) => {
      if (deploymentStage == STAGE.RES) return;
      if (deploymentEnvironment.account == '-') return;
      const logRetentionRoleArn = AppStage.getLogRetentionRoleArn(
        deploymentEnvironment.account,
        deploymentEnvironment.region,
        deploymentStage as STAGE,
        props.applicationName,
      );

      const preDeployStep = new PreDeployBuildStep(deploymentStage as STAGE, {
        env: {
          TARGET_REGION: deploymentEnvironment.region,
        },
      });

      pipeline.addStage(new AppStage(this, deploymentStage, {
        env: deploymentEnvironment,
        resAccount: props.deployments.RES.account,
        applicationName: props.applicationName,
        applicationQualifier: props.applicationQualifier,
        logRetentionInDays: props.logRetentionInDays,
        stage: deploymentStage as STAGE,
        complianceLogBucketName: props.complianceLogBucketName[deploymentStage as DeploymentStage],
      }), {
        pre: [
          preDeployStep,
          // add manual approval step for all stages, except DEV
          ...(deploymentStage != STAGE.DEV ?
            [
              preDeployStep.appendManualApprovalStep(),
            ]
            : []
          ),
        ],
        post: [
          new PostDeployBuildStep(deploymentStage as STAGE, {
            env: {
              ACCOUNT_ID: deploymentEnvironment.account,
              TARGET_REGION: deploymentEnvironment.region,
            },
          },
          props.applicationName,
          props.logRetentionInDays,
          logRetentionRoleArn,
          ),
        ],
      });
    });

    pipeline.buildPipeline();
  }
}
