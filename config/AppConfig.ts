// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import { IAppConfig, ICodeBuildEnvSettings, RepositoryType, STAGE } from './Types';
import { Environment } from './Utils';
import { VpcType } from './VpcConfig';
import { CodeGuruSeverityThreshold } from '../lib/cdk-pipeline/core/CodeGuruReviewStep';

export const codeBuildEnvSettings: ICodeBuildEnvSettings = {
  isPrivileged: true,
  buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
};

const region: string = Environment.getEnvVar('AWS_REGION');
const deploymentAccounts = {
  RES: Environment.getEnvVar('ACCOUNT_RES'),
  DEV: Environment.getEnvVar('ACCOUNT_DEV'),
  INT: Environment.getEnvVar('ACCOUNT_INT'),
};

export const AppConfig: IAppConfig = {
  applicationName: Environment.getEnvVar('npm_package_config_applicationName'),
  deploymentAccounts: deploymentAccounts,
  applicationQualifier: Environment.getEnvVar('npm_package_config_cdkQualifier'),
  region: region,
  logRetentionInDays: '365',
  codeBuildEnvSettings: codeBuildEnvSettings,
  codeGuruScanThreshold: CodeGuruSeverityThreshold.HIGH,
  vpc: {
    type: Environment.getEnvVar('CICD_VPC_TYPE', '') as VpcType || Environment.getEnvVar('npm_package_config_cicdVpcType') as VpcType,
    VPC: {
      // preserving original functionality where vpc is created from defaults.
      cidrBlock: Environment.getEnvVar('CICD_VPC_CIDR', '') || Environment.getEnvVar('npm_package_config_cicdVpcCidr', '172.31.0.0/20'),
      subnetCidrMask: parseInt(Environment.getEnvVar('CICD_VPC_CIDR_MASK', '') || Environment.getEnvVar('npm_package_config_cicdVpcCidrMask', '24')),
      maxAzs: parseInt(Environment.getEnvVar('CICD_VPC_MAXAZS', '') || Environment.getEnvVar('npm_package_config_cicdVpcMaxAZs', '2')),
    },
    VPC_FROM_LOOK_UP: {
      vpcId: Environment.getEnvVar('CICD_VPC_ID', '') || Environment.getEnvVar('npm_package_config_cicdVpcId', ''),
    },
  },
  proxy: {
    proxySecretArn: Environment.getEnvVar('PROXY_SECRET_ARN', ''),
    noProxy: [`${region}.amazonaws.com`],
    proxyTestUrl: 'https://docs.aws.amazon.com',
  },
  repositoryConfig: {
    selected: Environment.getEnvVar('npm_package_config_repositoryType') as RepositoryType,
    GITHUB: {
      name: Environment.getEnvVar('npm_package_config_repositoryName'),
      codeStarConnectionArn: Environment.getEnvVar('CODESTAR_CONNECTION_ARN', ''),
      branch: 'main',
    },
    CODECOMMIT: {
      name: Environment.getEnvVar('npm_package_config_repositoryName'),
      description: 'CodeCommit repository used for the CI/CD pipeline',
      branch: 'main',
      codeBuildConfig: codeBuildEnvSettings,
    },
  },
  complianceLogBucketName: {
    RES: `compliance-log-${deploymentAccounts.RES}-${region}`,
    DEV: `compliance-log-${deploymentAccounts.DEV}-${region}`,
    INT: `compliance-log-${deploymentAccounts.INT}-${region}`,
  },
};
