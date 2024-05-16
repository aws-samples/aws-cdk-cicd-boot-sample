// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import * as cdk from 'aws-cdk-lib';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as pipelines from 'aws-cdk-lib/pipelines';
import { NagSuppressions } from 'cdk-nag';
import { Construct, IConstruct } from 'constructs';
import { CodeGuruSecurityStep, CodeGuruSeverityThreshold } from './constructs/CodeGuruSecurityStepConstruct';

interface Props extends PipelineProps {
  applicationQualifier: string;
  pipelineName: string;
  rolePolicies?: iam.PolicyStatement[];
}

export interface IVpcProps {
  vpc: ec2.IVpc;
  proxy?: {
    noProxy: string[];
    proxySecretArn: string;
    proxyTestUrl: string;
  };
}

export interface PipelineProps {
  repositoryInput: pipelines.IFileSetProducer;
  branch: string;
  isDockerEnabledForSynth?: boolean;
  buildImage?: codebuild.IBuildImage;
  codeGuruScanThreshold?: CodeGuruSeverityThreshold;
  vpcProps?: IVpcProps;
  pipelineVariables?: {[key in string]: string};
  primaryOutputDirectory: string;
}

// ensure that VPC is detached from codebuild project on VPC deletion
class CodeBuildAspect implements cdk.IAspect {
  public visit(node: IConstruct): void {
    if (node instanceof codebuild.Project) {
      (node.node.defaultChild as codebuild.CfnProject).addPropertyOverride ('VpcConfig', {
        VpcId: { Ref: 'AWS::NoValue' },
      });
    };
  };
};

export class CDKPipeline extends pipelines.CodePipeline {
  static readonly pipelineCommands: string[] =
    [
      './scripts/check-audit.sh',
      '. ./scripts/warming.sh',
      './scripts/build.sh',
      './scripts/test.sh',
      './scripts/cdk-synth.sh',
    ];

  static readonly installCommands: string[] =
    [
      'pip3 install awscli --upgrade --quiet',
    ];

  private readonly codeGuruScanThreshold?: CodeGuruSeverityThreshold;
  private readonly applicationQualifier: string;
  private readonly pipelineName: string;

  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id, {
      pipelineName: props.pipelineName,
      crossAccountKeys: true,
      enableKeyRotation: true,
      dockerEnabledForSynth: props.isDockerEnabledForSynth,
      synth: new pipelines.ShellStep('Synth', {
        input: props.repositoryInput,
        installCommands: CDKPipeline.installCommands,
        commands: CDKPipeline.pipelineCommands,
        env: {
          CDK_QUALIFIER: props.applicationQualifier,
          AWS_REGION: cdk.Stack.of(scope).region,
          ...props.pipelineVariables,
        },
        primaryOutputDirectory: props.primaryOutputDirectory,
      }),
      codeBuildDefaults: {
        ...CDKPipeline.generateVPCCodeBuildDefaults(props.vpcProps),
        partialBuildSpec: CDKPipeline.getPartialBuildSpec(props.vpcProps),
        buildEnvironment: {
          buildImage: props.buildImage,
        },
        rolePolicy: props.rolePolicies,
      },
    });

    this.codeGuruScanThreshold = props.codeGuruScanThreshold;
    this.applicationQualifier = props.applicationQualifier;
    this.pipelineName = props.pipelineName;

    if (!props.vpcProps) {cdk.Aspects.of(this).add(new CodeBuildAspect());}
  }

  static getDefaultPartialBuildSpec() {
    return codebuild.BuildSpec.fromObject({
      version: '0.2',
      env: {
        shell: 'bash',
      },
    });
  }

  static getPartialBuildSpec(vpcProps?: IVpcProps) {
    const buildSpec = CDKPipeline.getDefaultPartialBuildSpec();

    if (vpcProps?.proxy?.proxySecretArn) {
      const {
        proxy: {
          noProxy,
          proxySecretArn,
          proxyTestUrl,
        },
      } = vpcProps;

      // Construct environment variables
      const envVariables = {
        NO_PROXY: noProxy.join(', '),
        AWS_STS_REGIONAL_ENDPOINTS: 'regional',
      };

      // Construct secrets manager object
      const secretsManager = {
        PROXY_USERNAME: `${proxySecretArn}:username`,
        PROXY_PASSWORD: `${proxySecretArn}:password`,
        HTTP_PROXY_PORT: `${proxySecretArn}:http_proxy_port`,
        HTTPS_PROXY_PORT: `${proxySecretArn}:https_proxy_port`,
        PROXY_DOMAIN: `${proxySecretArn}:proxy_domain`,
      };

      // Merge the constructed objects with existing buildSpec
      return codebuild.mergeBuildSpecs(buildSpec, codebuild.BuildSpec.fromObject({
        env: {
          'variables': envVariables,
          'secrets-manager': secretsManager,
        },
        phases: {
          install: {
            commands: [
              CDKPipeline.getInstallCommands(vpcProps),
            ],
          },
        },
      }));
    }

    return buildSpec;
  }

  static generateVPCCodeBuildDefaults(vpcProps?: IVpcProps): pipelines.CodeBuildOptions | {} {
    if (!vpcProps) return {};

    return {
      vpc: vpcProps.vpc,
      subnetSelection: vpcProps.vpc.isolatedSubnets ?? vpcProps.vpc.privateSubnets,
    };
  }

  public static getInstallCommands(vpcProps: IVpcProps) : string {
    return 'export HTTP_PROXY="http://$PROXY_USERNAME:$PROXY_PASSWORD@$PROXY_DOMAIN:$HTTP_PROXY_PORT"; ' +
    'export HTTPS_PROXY="https://$PROXY_USERNAME:$PROXY_PASSWORD@$PROXY_DOMAIN:$HTTPS_PROXY_PORT"; ' +
    'echo "--- Proxy Test ---"; ' +
    `curl -Is --connect-timeout 5 ${vpcProps!.proxy!.proxyTestUrl} | grep "HTTP/"; ` +
    'if [ -f /var/run/docker.pid ]; then ' +
    'echo "--- Configuring docker env ---" ' +
    '&& mkdir ~/.docker/ ' +
    '&& echo -n "{\\"proxies\\": {\\"default\\": {\\"httpProxy\\": \\"$HTTP_PROXY\\",\\"httpsProxy\\": \\"$HTTPS_PROXY\\",\\"noProxy\\": \\"$NO_PROXY\\"}}}" > ~/.docker/config.json ' +
    '&& cat ~/.docker/config.json ' +
    '&& echo "Kill and restart the docker daemon so that it reads the PROXY env variables" ' +
    '&& kill "$(cat /var/run/docker.pid)" ' +
    '&& while kill -0 "$(cat /var/run/docker.pid)" ; do sleep 1 ; done ' +
    '&& /usr/local/bin/dockerd-entrypoint.sh > /dev/null 2>&1 ' +
    '&& echo "--- Docker daemon restarted ---"; ' +
    'fi';
  }

  public buildPipeline(): void {
    super.buildPipeline();

    if (this.codeGuruScanThreshold) {
      this.applyCodeGuruScan(this.codeGuruScanThreshold);
    }

    NagSuppressions.addResourceSuppressions(this.synthProject, [
      {
        id: 'AwsSolutions-CB3',
        reason: 'Suppress AwsSolutions-CB3 - Privileged mode is required to build Lambda functions written in JS/TS',
      },
    ], true);

    NagSuppressions.addResourceSuppressions(this, [
      {
        id: 'AwsSolutions-IAM5',
        reason: 'Suppress AwsSolutions-IAM5 on the known Action wildcards.',
        appliesTo: [
          {
            regex:
              '/(.*)(Action::kms:ReEncrypt|Action::s3:Abort|Action::s3:GetObject|Action::s3:DeleteObject|Action::s3:List|Action::s3:GetBucket|Action::kms:GenerateDataKey(.*)|Action::ec2messages:GetEndpoint|Action::ec2messages(.*)|Action::ssmmessages(.*)|Action::ssmmessages:OpenDataChannel)(.*)$/g',
          },
        ],
      },
    ], true);

    NagSuppressions.addResourceSuppressionsByPath(
      cdk.Stack.of(this),
      [
        `${cdk.Stack.of(this).stackName}/CdkPipeline/Pipeline`,
        `${cdk.Stack.of(this).stackName}/CdkPipeline/UpdatePipeline`,
      ],
      [
        {
          id: 'AwsSolutions-IAM5',
          reason: 'Suppress AwsSolutions-IAM5 on the self mutating pipeline.',
        },
      ],
      true,
    );

    // Assets stage is only included if there are assets which must be uploaded
    if (this.pipeline.stages.find((stage) => stage.stageName === 'Assets')) {
      NagSuppressions.addResourceSuppressionsByPath(
        cdk.Stack.of(this),
        [`${cdk.Stack.of(this).stackName}/CdkPipeline/Assets`],
        [
          {
            id: 'AwsSolutions-IAM5',
            reason: 'Suppress AwsSolutions-IAM5 on the self mutating pipeline.',
          },
        ],
        true,
      );
    }
  }

  private applyCodeGuruScan(threshold: CodeGuruSeverityThreshold) {

    const getSourceOutput = () => this.pipeline.stages.find(stage => 'Source' === stage.stageName)?.actions.at(0)?.actionProperties.outputs?.at(0)!;
    const getBuildStage = () => this.pipeline.stages.find(stage => 'Build' === stage.stageName)!;

    const codeGuruSecurityStep = new CodeGuruSecurityStep(this, 'CodeGuruReviewStep', {
      applicationName: this.pipelineName,
      applicationQualifier: this.applicationQualifier,
      sourceOutput: getSourceOutput(),
      threshold,
    });

    getBuildStage().addAction(codeGuruSecurityStep.action);
  }
}