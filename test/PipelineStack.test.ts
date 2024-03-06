// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import * as cdk from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { TestAppConfig } from './TestConfig';
import { STAGE } from '../config/Types';
import { CodeGuruSeverityThreshold } from '../lib/cdk-pipeline/core/constructs/CodeGuruSecurityStepConstruct';
import { PipelineStack } from '../lib/cdk-pipeline/core/PipelineStack';
import { RepositoryStack } from '../lib/stacks/core/RepositoryStack';
import { SSMParameterStack } from '../lib/stacks/core/SSMParameterStack';

describe('pipeline-tests', () => {

  describe('pipeline-stack-test-codecommit', () => {
    const app = new cdk.App();

    new SSMParameterStack(app, 'SSMParameterStack', {
      env: { account: TestAppConfig.deploymentAccounts.RES, region: TestAppConfig.region },
      applicationQualifier: TestAppConfig.applicationQualifier,
    });

    const repository = new RepositoryStack(app, 'CodeCommitRepositoryStack', {
      env: { account: TestAppConfig.deploymentAccounts.RES, region: TestAppConfig.region },
      applicationName: TestAppConfig.applicationName,
      applicationQualifier: TestAppConfig.applicationQualifier,
      repositoryConfig: {
        ...TestAppConfig.repositoryConfig,
        selected: 'CODECOMMIT',
      },
    });

    const template = Template.fromStack(
      new PipelineStack(app, 'PipelineStackCodeCommit', {
        env: { account: TestAppConfig.deploymentAccounts.RES, region: TestAppConfig.region },
        applicationName: TestAppConfig.applicationName,
        applicationQualifier: TestAppConfig.applicationQualifier,
        logRetentionInDays: TestAppConfig.logRetentionInDays,
        complianceLogBucketName: TestAppConfig.complianceLogBucketName,
        deployments: {
          RES: { account: TestAppConfig.deploymentAccounts.RES, region: TestAppConfig.region },
          DEV: { account: TestAppConfig.deploymentAccounts.DEV, region: TestAppConfig.region },
          INT: { account: TestAppConfig.deploymentAccounts.INT, region: TestAppConfig.region },
        },
        pipelineProps: {
          repositoryInput: repository.pipelineInput,
          isDockerEnabledForSynth: TestAppConfig.codeBuildEnvSettings.isPrivileged,
          buildImage: TestAppConfig.codeBuildEnvSettings.buildImage,
          branch: repository.repositoryBranch,
          primaryOutputDirectory: TestAppConfig.codeBuildEnvSettings.synthOutputDirectory,
          pipelineVariables: {
            ...repository.pipelineEnvVars,
            PROXY_SECRET_ARN: TestAppConfig.proxy?.proxySecretArn ?? '',
          },
        },
      }));

    test('Check if Events rule exists', () => {
      template.resourceCountIs('AWS::Events::Rule', 1);
      template.hasResourceProperties('AWS::Events::Rule', {
        EventPattern: {
          source: ['aws.codecommit'],
        },
        State: 'ENABLED',
      });
    });

    test('Check if Pipeline ENV variables exist', () => {
      template.hasResourceProperties('AWS::CodeBuild::Project', {
        Environment: {
          EnvironmentVariables: [{
            Name: 'CDK_QUALIFIER',
            Type: 'PLAINTEXT',
            Value: TestAppConfig.applicationQualifier,
          }, {
            Name: 'AWS_REGION',
            Type: 'PLAINTEXT',
            Value: TestAppConfig.region,
          }, {
            Name: 'PROXY_SECRET_ARN',
            Type: 'PLAINTEXT',
            Value: TestAppConfig.proxy?.proxySecretArn ?? '',
          }],
        },
      });
    });

    test('Check if CodePipeline Pipeline exists', () => {
      template.resourceCountIs('AWS::CodePipeline::Pipeline', 1);
      template.hasResourceProperties('AWS::CodePipeline::Pipeline', {
        Stages: [
          {
            Name: 'Source',
          },
          {
            Name: 'Build',
          },
          {
            Name: 'UpdatePipeline',
          },
          {
            Name: 'Assets',
          },
          {},
          {},
        ],
      });
    });

    test('Check if CodeGuru Step does not exist', () => {
      template.resourcePropertiesCountIs('AWS::CodeBuild::Project', {
        Artifacts: {
          Type: 'CODEPIPELINE',
        },
        Environment: {
          Image: 'public.ecr.aws/l6c8c5q3/codegurusecurity-actions-public:latest',
        },
        Name: `${TestAppConfig.applicationQualifier}CodeGuruSecurity`,
      }, 0);
    });

  });

  describe('pipeline-stack-test-codestar', () => {
    const app = new cdk.App();

    new SSMParameterStack(app, 'SSMParameterStack', {
      env: { account: TestAppConfig.deploymentAccounts.RES, region: TestAppConfig.region },
      applicationQualifier: TestAppConfig.applicationQualifier,
    });

    const repository = new RepositoryStack(app, 'CodeCommitRepositoryStack', {
      env: { account: TestAppConfig.deploymentAccounts.RES, region: TestAppConfig.region },
      applicationName: TestAppConfig.applicationName,
      applicationQualifier: TestAppConfig.applicationQualifier,
      repositoryConfig: {
        ...TestAppConfig.repositoryConfig,
        selected: 'GITHUB',
      },
    });

    const template = Template.fromStack(
      new PipelineStack(app, 'PipelineStackCodeStar', {
        env: { account: TestAppConfig.deploymentAccounts.RES, region: TestAppConfig.region },
        applicationName: TestAppConfig.applicationName,
        applicationQualifier: TestAppConfig.applicationQualifier,
        logRetentionInDays: TestAppConfig.logRetentionInDays,
        complianceLogBucketName: TestAppConfig.complianceLogBucketName,
        deployments: {
          RES: { account: TestAppConfig.deploymentAccounts.RES, region: TestAppConfig.region },
          DEV: { account: TestAppConfig.deploymentAccounts.DEV, region: TestAppConfig.region },
          INT: { account: TestAppConfig.deploymentAccounts.INT, region: TestAppConfig.region },
        },
        pipelineProps: {
          repositoryInput: repository.pipelineInput,
          isDockerEnabledForSynth: TestAppConfig.codeBuildEnvSettings.isPrivileged,
          buildImage: TestAppConfig.codeBuildEnvSettings.buildImage,
          branch: repository.repositoryBranch,
          primaryOutputDirectory: TestAppConfig.codeBuildEnvSettings.synthOutputDirectory,
          pipelineVariables: {
            ...repository.pipelineEnvVars,
            PROXY_SECRET_ARN: TestAppConfig.proxy?.proxySecretArn ?? '',
          },
          codeGuruScanThreshold: CodeGuruSeverityThreshold.HIGH,
        },
      }));

    test('Check if Pipeline ENV variables exist', () => {
      template.hasResourceProperties('AWS::CodeBuild::Project', {
        Environment: {
          EnvironmentVariables: [{
            Name: 'CDK_QUALIFIER',
            Type: 'PLAINTEXT',
            Value: TestAppConfig.applicationQualifier,
          }, {
            Name: 'AWS_REGION',
            Type: 'PLAINTEXT',
            Value: TestAppConfig.region,
          }, {
            Name: 'CODESTAR_CONNECTION_ARN',
            Type: 'PLAINTEXT',
            Value: TestAppConfig.repositoryConfig.GITHUB.codeStarConnectionArn,
          }, {
            Name: 'PROXY_SECRET_ARN',
            Type: 'PLAINTEXT',
            Value: TestAppConfig.proxy?.proxySecretArn ?? '',
          }],
        },
      });
    });

    test('Check if CodePipeline Pipeline exists', () => {
      template.resourceCountIs('AWS::CodePipeline::Pipeline', 1);
      template.hasResourceProperties('AWS::CodePipeline::Pipeline', {
        Stages: [
          {
            Name: 'Source',
          },
          {
            Name: 'Build',
          },
          {
            Name: 'UpdatePipeline',
          },
          {
            Name: 'Assets',
          },
          {},
          {},
        ],
      });
    });

    test('Check if CodeGuru Step exists', () => {
      template.resourcePropertiesCountIs('AWS::CodeBuild::Project', {
        Artifacts: {
          Type: 'CODEPIPELINE',
        },
        Name: `${TestAppConfig.applicationQualifier}CodeGuruSecurity`,
      }, 1);
    });
  });


  describe('pipeline-stack-test-extending-STAGE', () => {
    const app = new cdk.App();

    new SSMParameterStack(app, 'SSMParameterStack', {
      env: { account: TestAppConfig.deploymentAccounts.RES, region: TestAppConfig.region },
      applicationQualifier: TestAppConfig.applicationQualifier,
    });

    const repository = new RepositoryStack(app, 'CodeCommitRepositoryStack', {
      env: { account: TestAppConfig.deploymentAccounts.RES, region: TestAppConfig.region },
      applicationName: TestAppConfig.applicationName,
      applicationQualifier: TestAppConfig.applicationQualifier,
      repositoryConfig: {
        ...TestAppConfig.repositoryConfig,
        selected: 'GITHUB',
      },
    });

    const template = Template.fromStack(
      new PipelineStack(app, 'PipelineStackExtendingStage', {
        env: { account: TestAppConfig.deploymentAccounts.RES, region: TestAppConfig.region },
        applicationName: TestAppConfig.applicationName,
        applicationQualifier: TestAppConfig.applicationQualifier,
        logRetentionInDays: TestAppConfig.logRetentionInDays,
        complianceLogBucketName: TestAppConfig.complianceLogBucketName,
        deployments: {
          RES: { account: TestAppConfig.deploymentAccounts.RES, region: TestAppConfig.region },
          DEV: { account: TestAppConfig.deploymentAccounts.DEV, region: TestAppConfig.region },
          INT: {
            account: TestAppConfig.deploymentAccounts.INT,
            region: TestAppConfig.region,
            provide: context => {

              const stage = new cdk.Stage(context.scope, STAGE.INT);
              const stack = new cdk.Stack(stage, 'TestStack');
              new cdk.CfnOutput(stack, 'ConstructTest', { value: 'INT' });

              return {
                stage,
              };

            },
          },
          EXP: { account: TestAppConfig.deploymentAccounts.EXP, region: TestAppConfig.region },
        },
        pipelineProps: {
          repositoryInput: repository.pipelineInput,
          isDockerEnabledForSynth: TestAppConfig.codeBuildEnvSettings.isPrivileged,
          buildImage: TestAppConfig.codeBuildEnvSettings.buildImage,
          branch: repository.repositoryBranch,
          primaryOutputDirectory: TestAppConfig.codeBuildEnvSettings.synthOutputDirectory,
          pipelineVariables: {
            ...repository.pipelineEnvVars,
            PROXY_SECRET_ARN: TestAppConfig.proxy?.proxySecretArn ?? '',
          },
          codeGuruScanThreshold: CodeGuruSeverityThreshold.HIGH,
        },
      }));

    test('Check if CodePipeline Pipeline exists with all STAGE', () => {
      template.resourceCountIs('AWS::CodePipeline::Pipeline', 1);
      template.hasResourceProperties('AWS::CodePipeline::Pipeline', {
        Stages: [
          {
            Name: 'Source',
          },
          {
            Name: 'Build',
          },
          {
            Name: 'UpdatePipeline',
          },
          {
            Name: 'Assets',
          },
          {
            Name: 'DEV',
          },
          {
            Name: 'INT',
            Actions: [
              {},
              {
                Name: 'Deploy',
                Configuration: {
                  StackName: 'INT-TestStack',
                },
              },
            ],
          },
          {
            Name: 'EXP',
          },
        ],
      });
    });

  });

  describe('pipeline-stack-test-proxy-vpc', () => {
    const app = new cdk.App();

    new SSMParameterStack(app, 'SSMParameterStack', {
      env: { account: TestAppConfig.deploymentAccounts.RES, region: TestAppConfig.region },
      applicationQualifier: TestAppConfig.applicationQualifier,
    });

    const repository = new RepositoryStack(app, 'CodeCommitRepositoryStack', {
      env: { account: TestAppConfig.deploymentAccounts.RES, region: TestAppConfig.region },
      applicationName: TestAppConfig.applicationName,
      applicationQualifier: TestAppConfig.applicationQualifier,
      repositoryConfig: {
        ...TestAppConfig.repositoryConfig,
        selected: 'GITHUB',
      },
    });

    const vpcStack = new cdk.Stack(app, 'VPCStack', {
      env: { account: TestAppConfig.deploymentAccounts.RES, region: TestAppConfig.region },
    });

    const vpc = new ec2.Vpc(vpcStack, 'Vpc');

    const template = Template.fromStack(
      new PipelineStack(app, 'PipelineStackExtendingStage', {
        env: { account: TestAppConfig.deploymentAccounts.RES, region: TestAppConfig.region },
        applicationName: TestAppConfig.applicationName,
        applicationQualifier: TestAppConfig.applicationQualifier,
        logRetentionInDays: TestAppConfig.logRetentionInDays,
        complianceLogBucketName: TestAppConfig.complianceLogBucketName,
        deployments: {
          RES: { account: TestAppConfig.deploymentAccounts.RES, region: TestAppConfig.region },
          DEV: { account: TestAppConfig.deploymentAccounts.DEV, region: TestAppConfig.region },
          INT: { account: TestAppConfig.deploymentAccounts.INT, region: TestAppConfig.region },
        },
        pipelineProps: {
          repositoryInput: repository.pipelineInput,
          isDockerEnabledForSynth: TestAppConfig.codeBuildEnvSettings.isPrivileged,
          buildImage: TestAppConfig.codeBuildEnvSettings.buildImage,
          branch: repository.repositoryBranch,
          primaryOutputDirectory: TestAppConfig.codeBuildEnvSettings.synthOutputDirectory,
          pipelineVariables: {
            ...repository.pipelineEnvVars,
          },
          vpcProps: {
            vpc: vpc,
            proxy: {
              noProxy: [`${TestAppConfig.region}.amazonaws.com`],
              proxySecretArn: `arn:aws:secretsmanager:${TestAppConfig.region}:${TestAppConfig.deploymentAccounts.RES}:secret:/proxy/credentials/default-aaaaaa`,
              proxyTestUrl: 'proxy-test.com',
            },
          },
          codeGuruScanThreshold: CodeGuruSeverityThreshold.HIGH,
        },
      }));

    test('Check if CodePipeline Pipeline exists with all STAGE', () => {
      template.resourceCountIs('AWS::CodePipeline::Pipeline', 1);
      template.hasResourceProperties('AWS::CodePipeline::Pipeline', {
        Stages: [
          {
            Name: 'Source',
          },
          {
            Name: 'Build',
          },
          {
            Name: 'UpdatePipeline',
          },
          {
            Name: 'Assets',
          },
          {
            Name: 'DEV',
          },
          {
            Name: 'INT',
          },
        ],
      });
      const codeBuildProjects = template.findResources('AWS::CodeBuild::Project');
      const synthProject = codeBuildProjects[Object.keys(codeBuildProjects).find(id => id.startsWith('CdkPipelineBuildSynthCdkBuildProject'))!!];

      Match.objectLike({
        Artifacts: {
          Type: 'CODEPIPELINE',
        },
        Description: 'Pipeline step PipelineStackExtendingStage/Pipeline/Build/Synth',
        Environment: {
          ComputeType: 'BUILD_GENERAL1_SMALL',
          EnvironmentVariables: [
            {
              Name: 'AWS_REGION',
              Type: 'PLAINTEXT',
              Value: TestAppConfig.region,
            },
            {
              Name: 'CODESTAR_CONNECTION_ARN',
              Type: 'PLAINTEXT',
              Value: TestAppConfig.repositoryConfig.GITHUB.codeStarConnectionArn,
            },
            {
              Name: 'CDK_QUALIFIER',
              Type: 'PLAINTEXT',
              Value: TestAppConfig.applicationQualifier,
            },
          ],
          Image: TestAppConfig.codeBuildEnvSettings.buildImage,
          PrivilegedMode: TestAppConfig.codeBuildEnvSettings.isPrivileged,
          Type: 'LINUX_CONTAINER',
        },
        Source: {
          BuildSpec: '{\n  "version": "0.2",\n  "env": {\n    "shell": "bash",\n    "variables": {\n      "NO_PROXY": "eu-west-1.amazonaws.com",\n      "AWS_STS_REGIONAL_ENDPOINTS": "regional"\n    },\n    "secrets-manager": {\n      "PROXY_USERNAME": "arn:aws:secretsmanager:eu-west-1:123456789012:secret:/proxy/credentials/default-aaaaaa:username",\n      "PROXY_PASSWORD": "arn:aws:secretsmanager:eu-west-1:123456789012:secret:/proxy/credentials/default-aaaaaa:password",\n      "HTTP_PROXY_PORT": "arn:aws:secretsmanager:eu-west-1:123456789012:secret:/proxy/credentials/default-aaaaaa:http_proxy_port",\n      "HTTPS_PROXY_PORT": "arn:aws:secretsmanager:eu-west-1:123456789012:secret:/proxy/credentials/default-aaaaaa:https_proxy_port",\n      "PROXY_DOMAIN": "arn:aws:secretsmanager:eu-west-1:123456789012:secret:/proxy/credentials/default-aaaaaa:proxy_domain"\n    }\n  },\n  "phases": {\n    "install": {\n      "commands": [\n        "export HTTP_PROXY=\\"http://$PROXY_USERNAME:$PROXY_PASSWORD@$PROXY_DOMAIN:$HTTP_PROXY_PORT\\"",\n        "export HTTPS_PROXY=\\"https://$PROXY_USERNAME:$PROXY_PASSWORD@$PROXY_DOMAIN:$HTTPS_PROXY_PORT\\"",\n        "echo \\"--- Proxy Test ---\\"",\n        "curl -Is --connect-timeout 5 proxy-test.com | grep \\"HTTP/\\"",\n        "./scripts/proxy.sh",\n        "pip3 install awscli --upgrade --quiet"\n      ]\n    },\n    "build": {\n      "commands": [\n        "./scripts/check-audit.sh",\n        ". ./scripts/warming.sh",\n        "./scripts/build.sh",\n        "./scripts/test.sh",\n        "./scripts/cdk-synth.sh"\n      ]\n    }\n  },\n  "artifacts": {\n    "base-directory": "./cdk.out",\n    "files": [\n      "**/*"\n    ]\n  }\n}',
        },
      }).test(synthProject.Properties as any);
    });

  });
});