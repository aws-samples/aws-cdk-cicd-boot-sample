// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { ApprovalRuleTemplate, ApprovalRuleTemplateRepositoryAssociation } from '@cloudcomponents/cdk-pull-request-approval-rule';
import { PullRequestCheck } from '@cloudcomponents/cdk-pull-request-check';
import * as cdk from 'aws-cdk-lib';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as codecommit from 'aws-cdk-lib/aws-codecommit';
import * as codegurureviewer from 'aws-cdk-lib/aws-codegurureviewer';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as pipelines from 'aws-cdk-lib/pipelines';
import * as nag from 'cdk-nag';
import { Construct } from 'constructs';
import { ICodeCommitConfig } from '../../../../config/Types';
import { CDKPipeline, IVpcProps } from '../../../cdk-pipeline/core/CDKPipeline';
import { SSMParameterStack } from '../SSMParameterStack';

interface Props extends ICodeCommitConfig {
  applicationName: string;
  applicationQualifier: string;
  vpcProps?: IVpcProps;
}

export class CodeCommitRepositoryConstruct extends Construct {
  readonly pipelineInput: pipelines.IFileSetProducer;

  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id);

    const repository = new codecommit.Repository(this, 'Repository', {
      repositoryName: props.name,
      description: props.description,
    });

    this.pipelineInput = pipelines.CodePipelineSource.codeCommit(repository, props.branch);

    // CODEGURU REVIEW RESOURCES
    if (props.codeGuruReviewer) {
      new codegurureviewer.CfnRepositoryAssociation(this, 'RepositoryAssociation', {
        name: repository.repositoryName,
        type: 'CodeCommit',
      });
    }
    const approvalRuleTemplateName = new ApprovalRuleTemplate(this, 'ApprovalRuleTemplate', {
      approvalRuleTemplateName: `${props.applicationName}-Require-1-Approver`,
      template: {
        approvers: {
          numberOfApprovalsNeeded: 1,
        },
      },
    }).approvalRuleTemplateName;

    new ApprovalRuleTemplateRepositoryAssociation(this, 'ApprovalRuleTemplateRepositoryAssociation', {
      approvalRuleTemplateName,
      repository,
    });

    const buildSpec = CDKPipeline.getPartialBuildSpec(props.vpcProps);

    codebuild.mergeBuildSpecs(buildSpec, codebuild.BuildSpec.fromObject({
      phases: {
        install: {
          commands: [
            `export CDK_QUALIFIER=${props.applicationQualifier}`,
          ],
        },
        build: {
          commands: CDKPipeline.pipelineCommands,
        },
      },
    }));

    const pullRequestCheck = new PullRequestCheck(this, 'PullRequestCheck', {
      repository,
      buildSpec: codebuild.BuildSpec.fromObject(buildSpec),
      vpc: props.vpcProps?.vpc,
      privileged: props.codeBuildConfig.isPrivileged,
      buildImage: props.codeBuildConfig.buildImage,
    });

    pullRequestCheck.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'sts:AssumeRole',
        ],
        resources: [
          'arn:aws:iam::*:role/cdk-*-lookup-role-*',
        ],
      }),
    );

    pullRequestCheck.addToRolePolicy(
      SSMParameterStack.getGetParameterPolicyStatement(cdk.Stack.of(this).account, cdk.Stack.of(this).region, props.applicationQualifier ),
    );

    if (props.vpcProps?.proxy?.proxySecretArn) {
      pullRequestCheck.addToRolePolicy(
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            'secretsmanager:GetSecretValue',
          ],
          resources: [
            props.vpcProps.proxy.proxySecretArn,
          ],
        }),
      );
    };

    nag.NagSuppressions.addResourceSuppressions(
      this,
      [
        {
          id: 'AwsSolutions-L1',
          reason: 'Suppress AwsSolutions-L1 - Outdated Lambda for PullRequestChecker',
        },
        {
          id: 'AwsSolutions-CB4',
          reason: 'Encryption not needed for CodeBuild pull request verification',
        },
        {
          id: 'AwsSolutions-CB3',
          reason: 'Suppress AwsSolutions-CB3 - Privileged mode is required to build Lambda functions written in JS/TS',
        },
      ],
      true,
    );

    nag.NagSuppressions.addResourceSuppressionsByPath(
      cdk.Stack.of(this),
      `${cdk.Stack.of(this).stackName}/CodeCommit/PullRequestCheck`,
      [
        {
          id: 'AwsSolutions-IAM5',
          reason: 'Suppress AwsSolutions-IAM5 on the PR check lambda function Resource.',
        },
      ],
      true,
    );
  }
}

