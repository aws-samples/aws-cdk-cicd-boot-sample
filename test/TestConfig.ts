// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import { IAppConfig, ICodeBuildEnvSettings } from '../config/Types';
import { CodeGuruSeverityThreshold } from '../lib/cdk-pipeline/core/constructs/CodeGuruSecurityStepConstruct';

const codeBuildEnvSettings: ICodeBuildEnvSettings = {
  isPrivileged: true,
  buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
};

export const TestAppConfig: IAppConfig = {
  applicationName: 'CICDBoot',
  deploymentAccounts: {
    RES: '123456789012',
    DEV: '123456789012',
    INT: '123456789012',
  },
  applicationQualifier: 'test',
  region: 'eu-west-1',
  logRetentionInDays: '365',
  codeBuildEnvSettings: codeBuildEnvSettings,
  codeGuruScanThreshold: CodeGuruSeverityThreshold.HIGH,
  vpc: {
    type: 'NO_VPC',
    VPC: {
      cidrBlock: '172.31.0.0/20',
      subnetCidrMask: 24,
      maxAzs: 2,
    },
    VPC_FROM_LOOK_UP: {
      vpcId: 'vpc-123',
    },
  },
  repositoryConfig: {
    selected: 'GITHUB',
    GITHUB: {
      name: 'owner/cicd-boot',
      codeStarConnectionArn: 'arn:aws:codestar-connections:eu-west-1:123456789123:host/abc123-example',
      branch: 'main',
    },
    CODECOMMIT: {
      name: 'owner/cicd-boot',
      description: 'CodeCommit repository used for the CI/CD pipeline',
      branch: 'main',
      codeBuildConfig: codeBuildEnvSettings,
      codeGuruReviewer: true,
    },
  },
  complianceLogBucketName: {
    RES: 'bucket-res',
    DEV: 'bucket-dev',
    INT: 'bucket-int',
  },
};