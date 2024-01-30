// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import { IVpcConfig } from './VpcConfig';
import { CodeGuruSeverityThreshold } from '../lib/cdk-pipeline/core/constructs/CodeGuruSecurityStepConstruct';

export interface ICodeBuildEnvSettings {
  isPrivileged: boolean;
  buildImage: codebuild.IBuildImage;
  synthOutputDirectory: string;
}

export type DeploymentStage = Exclude<STAGE, 'PROD'>; // remove Exclude statement to add PROD stage to deployments

export interface IAppConfig {
  applicationName: string;
  applicationQualifier: string;
  deploymentAccounts: {[key in DeploymentStage]: string};
  region: string;
  logRetentionInDays: string;
  codeBuildEnvSettings: ICodeBuildEnvSettings;
  codeGuruScanThreshold?: CodeGuruSeverityThreshold;
  vpc: IVpcConfig;
  proxy?: {
    proxySecretArn: string;
    noProxy: string[];
    proxyTestUrl: string;
  };
  repositoryConfig: IRepositoryConfig;
  complianceLogBucketName: {[key in DeploymentStage]: string};
}

export enum STAGE {
  RES = 'RES',
  DEV = 'DEV',
  INT = 'INT',
  PROD = 'PROD'
}

export type RepositoryType = 'GITHUB' | 'CODECOMMIT'

export interface ICodeCommitConfig {
  name: string;
  description: string;
  branch: string;
  codeBuildConfig: ICodeBuildEnvSettings;
  codeGuruReviewer: boolean;
}

export interface ICodeStarConfig {
  name: string;
  codeStarConnectionArn: string;
  branch: string;
}

export interface IRepositoryConfig {
  selected: RepositoryType;
  CODECOMMIT: ICodeCommitConfig;
  GITHUB: ICodeStarConfig;
}