// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import * as cdk from 'aws-cdk-lib';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import { IVpcConfig } from './VpcConfig';
import { CodeGuruSeverityThreshold } from '../lib/cdk-pipeline/core/constructs/CodeGuruSecurityStepConstruct';

export interface ICodeBuildEnvSettings {
  isPrivileged: boolean;
  buildImage: codebuild.IBuildImage;
  synthOutputDirectory: string;
}

type IStage = 'RES' | 'DEV' | 'INT' | 'PROD' | string;

export type DeploymentStage = Exclude<IStage, 'PROD'>; // remove Exclude statement to add PROD stage to deployments

export type Environment = Required<cdk.Environment>;

export type AllStage<T> = { [key in IStage]: T };
export type RequiredRESStage<T> = AllStage<T> & { 'RES': T };

export interface IAppConfig {
  applicationName: string;
  applicationQualifier: string;
  deploymentAccounts: RequiredRESStage<string>;
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
  complianceLogBucketName: RequiredRESStage<string>;
}

export class STAGE {

  public static readonly RES = 'RES';

  public static readonly DEV = 'DEV';

  public static readonly INT = 'INT';

  public static readonly PROD = 'PROD';
};

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