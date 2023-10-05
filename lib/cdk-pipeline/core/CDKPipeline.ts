// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import * as cdk from 'aws-cdk-lib';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as pipelines from 'aws-cdk-lib/pipelines';
import { Construct, IConstruct } from 'constructs';
import { CodeGuruReviewStep, CodeGuruSeverityThreshold } from './CodeGuruReviewStep';

interface Props extends PipelineProps {
  applicationQualifier: string;
  pipelineName: string;
  rolePolicies?: iam.PolicyStatement[];
}

export interface VpcProps {
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
  vpcProps?: VpcProps;
  pipelineVariables?: {[key in string]: string};
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
      './scripts/proxy.sh',
      './scripts/check-licenses.sh',
      './scripts/check-deps.sh',
      '. ./scripts/warming.sh',
      './scripts/build.sh',
      './scripts/test.sh',
      './scripts/cdk-synth.sh',
    ];

  private readonly codeGuruScanThreshold?: CodeGuruSeverityThreshold;
  private readonly applicationQualifier: string;

  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id, {
      pipelineName: props.pipelineName,
      crossAccountKeys: true,
      dockerEnabledForSynth: props.isDockerEnabledForSynth,
      synth: new pipelines.ShellStep('Synth', {
        input: props.repositoryInput,
        commands: CDKPipeline.pipelineCommands,
        env: {
          CDK_QUALIFIER: props.applicationQualifier,
          AWS_REGION: cdk.Stack.of(scope).region,
          ...props.pipelineVariables,
        },
        primaryOutputDirectory: './cdk.out',
      }),
      codeBuildDefaults: {
        ...CDKPipeline.generateVPCCodeBuildDefaults(scope, props.vpcProps),
        buildEnvironment: {
          buildImage: props.buildImage,
        },
        rolePolicy: props.rolePolicies,
      },
    });

    this.codeGuruScanThreshold = props.codeGuruScanThreshold;
    this.applicationQualifier = props.applicationQualifier;

    if (!props.vpcProps) {cdk.Aspects.of(this).add(new CodeBuildAspect());}
  }

  static generateVPCCodeBuildDefaults(scope: Construct, vpcProps?: VpcProps): pipelines.CodeBuildOptions | {} {
    if (!vpcProps) return {};

    const vpcConfig = {
      vpc: vpcProps.vpc,
      subnetSelection: vpcProps.vpc.isolatedSubnets,
    };

    if (vpcProps.proxy?.proxySecretArn) {
      return {
        partialBuildSpec: codebuild.BuildSpec.fromObject({
          version: '0.2',
          env: {
            'variables': {
              NO_PROXY: vpcProps.proxy.noProxy.join(','),
              AWS_STS_REGIONAL_ENDPOINTS: 'regional',
            },
            'secrets-manager': {
              PROXY_USERNAME: vpcProps.proxy.proxySecretArn.concat(':username'),
              PROXY_PASSWORD: vpcProps.proxy.proxySecretArn.concat(':password'),
              HTTP_PROXY_PORT: vpcProps.proxy.proxySecretArn.concat(':http_proxy_port'),
              HTTPS_PROXY_PORT: vpcProps.proxy.proxySecretArn.concat(':https_proxy_port'),
              PROXY_DOMAIN: vpcProps.proxy.proxySecretArn.concat(':proxy_domain'),
            },
          },
          phases: {
            install: {
              commands: [
                'export HTTP_PROXY="http://$PROXY_USERNAME:$PROXY_PASSWORD@$PROXY_DOMAIN:$HTTP_PROXY_PORT"',
                'export HTTPS_PROXY="https://$PROXY_USERNAME:$PROXY_PASSWORD@$PROXY_DOMAIN:$HTTPS_PROXY_PORT"',
                'echo "--- Proxy Test ---"',
                `curl -Is --connect-timeout 5 ${vpcProps.proxy.proxyTestUrl} | grep "HTTP/"`,
              ],
            },
          },
        }),
        ...vpcConfig,
      };
    }

    return {
      partialBuildSpec: codebuild.BuildSpec.fromObject({
        version: '0.2',
      }),
      ...vpcConfig,
    };
  }

  public buildPipeline(): void {
    super.buildPipeline();

    if (this.codeGuruScanThreshold) {
      this.applyCodeGuruScan(this.codeGuruScanThreshold);
    }
  }

  private applyCodeGuruScan(threshold: CodeGuruSeverityThreshold) {

    const getSourceOutput = () => this.pipeline.stages.find(stage => 'Source' === stage.stageName)?.actions.at(0)?.actionProperties.outputs?.at(0)!;
    const getBuildStage = () => this.pipeline.stages.find(stage => 'Build' === stage.stageName)!;

    const codeReviewStep = new CodeGuruReviewStep(this, 'CodeGuruReviewStep', {
      applicationQualifier: this.applicationQualifier,
      sourceOutput: getSourceOutput(),
      threshold,
    });

    getBuildStage().addAction(codeReviewStep.action);
  }
}