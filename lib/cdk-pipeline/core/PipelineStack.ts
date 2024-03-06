// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import * as cdk from 'aws-cdk-lib';
import * as codecommit from 'aws-cdk-lib/aws-codecommit';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { CDKPipeline, PipelineProps } from './CDKPipeline';
import { DefaultAppStageProvider } from './providers/DefaultAppStageProvider';
import { RequiredRESStage, STAGE } from '../../../config/Types';
import { SSMParameterStack } from '../../stacks/core/SSMParameterStack';

export interface RepositoryProps extends codecommit.RepositoryProps {
  readonly connectionArn: string;
}

export interface DeploymentProviderProps {
  env: Environment;
  scope: Construct;
  applicationName: string;
  applicationQualifier: string;
  logRetentionInDays: string;
  resAccount: string;
  stage: string;
  complianceLogBucketName: string;
}

export interface Deployment {
  readonly stage: cdk.Stage;
  readonly preDeploySteps?: cdk.pipelines.Step[];
  readonly postDeploySteps?: cdk.pipelines.Step[];
}

export interface IStageProvider {

  provide: (props: DeploymentProviderProps) => Deployment;

}

export type IDeploymentStage = Environment & Partial<IStageProvider>;
export type IDeploymentSTAGE = RequiredRESStage<IDeploymentStage>;


interface Props extends cdk.StackProps {
  applicationName: string;
  applicationQualifier: string;
  logRetentionInDays: string;
  deployments: IDeploymentSTAGE;
  pipelineProps: PipelineProps;
  complianceLogBucketName: RequiredRESStage<string>;
}

export interface Environment {
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

    const resAccount = props.deployments.RES!.account;

    Object.entries(props.deployments).forEach(([deploymentStage, deploymentConfig]) => {

      if (deploymentStage === 'RES' && !deploymentConfig.provide) {
        // There are no additional resources for the RES stage, so we don't need to create a stage.
        this.createAccountSSMParam(props.applicationQualifier, deploymentStage, deploymentConfig);
        return;
      }

      // Backward compatibility
      if ('-' === deploymentConfig.account) {
        // The account is not specified, so we don't need to create a stage.
        this.createAccountSSMParam(props.applicationQualifier, deploymentStage, deploymentConfig);
        return;
      }

      const provider: IStageProvider = deploymentConfig.provide
        ? deploymentConfig as IStageProvider
        : new DefaultAppStageProvider(deploymentConfig as Environment, deploymentStage !== 'DEV');

      const stageDeployment = provider.provide({
        env: deploymentConfig,
        scope: this,
        applicationName: props.applicationName,
        applicationQualifier: props.applicationQualifier,
        logRetentionInDays: props.logRetentionInDays,
        resAccount: resAccount,
        stage: deploymentStage,
        complianceLogBucketName: props.complianceLogBucketName[deploymentStage],
      });
      pipeline.addStage(stageDeployment.stage, {
        pre: stageDeployment.preDeploySteps,
        post: stageDeployment.postDeploySteps,
      });

      this.createAccountSSMParam(props.applicationQualifier, deploymentStage, deploymentConfig);
    });

    pipeline.buildPipeline();
  }

  private createAccountSSMParam(applicationQualifier: string, deploymentStage: STAGE, env: Environment) {
    switch (deploymentStage) {
      case STAGE.RES:
        SSMParameterStack.createParameterInSSMParameterStack(applicationQualifier, 'AccountRes', env.account);
        break;
      case STAGE.DEV:
        SSMParameterStack.createParameterInSSMParameterStack(applicationQualifier, 'AccountDev', env.account);
        break;
      case STAGE.INT:
        SSMParameterStack.createParameterInSSMParameterStack(applicationQualifier, 'AccountInt', env.account);
        break;
      case STAGE.PROD:
        SSMParameterStack.createParameterInSSMParameterStack(applicationQualifier, 'AccountProd', env.account);
        break;
      default:
        SSMParameterStack.createParameterInSSMParameterStack(applicationQualifier, `Account${deploymentStage}`, env.account);
        break;
    }
  }
}