#!/usr/bin/env node

// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import * as nag from 'cdk-nag';
import { SecurityControls } from './aspects';
import { AppConfig } from '../config/AppConfig';
import { STAGE } from '../config/Types';
import { PipelineStack } from '../lib/cdk-pipeline/core/PipelineStack';
import { EncryptionStack } from '../lib/stacks/core/EncryptionStack';

import { RepositoryStack } from '../lib/stacks/core/RepositoryStack';
import { SSMParameterStack } from '../lib/stacks/core/SSMParameterStack';
import { VPCStack } from '../lib/stacks/core/VPCStack';
import { NagUtils } from '../utils/suppressions';

const app = new cdk.App();

const repositoryStack = new RepositoryStack(app, `${AppConfig.applicationName}Repository`, {
  env: { account: AppConfig.deploymentAccounts.RES, region: AppConfig.region },
  applicationName: AppConfig.applicationName,
  applicationQualifier: AppConfig.applicationQualifier,
  repositoryConfig: AppConfig.repositoryConfig,
});

new SSMParameterStack(app, `${AppConfig.applicationName}SSMParameterStack`, {
  env: { account: AppConfig.deploymentAccounts.RES, region: AppConfig.region },
  applicationQualifier: AppConfig.applicationQualifier,
  parameter: {
    AccountRes: AppConfig.deploymentAccounts.RES,
    AccountDev: AppConfig.deploymentAccounts.DEV,
    AccountInt: AppConfig.deploymentAccounts.INT,
  },
});

const vpcStack = new VPCStack(app, `${AppConfig.applicationName}VPCStack`, {
  env: { account: AppConfig.deploymentAccounts.RES, region: AppConfig.region },
  vpcConfig: AppConfig.vpc,
  proxy: AppConfig.proxy,
  flowLogsBucketName: AppConfig.complianceLogBucketName.RES,
});

const encryptionStack = new EncryptionStack(app, `${AppConfig.applicationName}EncryptionStack`, {
  env: { account: AppConfig.deploymentAccounts.RES, region: AppConfig.region },
  applicationName: AppConfig.applicationName,
  stageName: STAGE.RES,
});

new PipelineStack(app, `${AppConfig.applicationName}PipelineStack`, {
  env: { account: AppConfig.deploymentAccounts.RES, region: AppConfig.region },
  applicationName: AppConfig.applicationName,
  applicationQualifier: AppConfig.applicationQualifier,
  logRetentionInDays: AppConfig.logRetentionInDays,
  deployments: {
    RES: { account: AppConfig.deploymentAccounts.RES, region: AppConfig.region },
    DEV: { account: AppConfig.deploymentAccounts.DEV, region: AppConfig.region },
    INT: { account: AppConfig.deploymentAccounts.INT, region: AppConfig.region },
  },
  pipelineProps: {
    repositoryInput: repositoryStack.pipelineInput,
    isDockerEnabledForSynth: AppConfig.codeBuildEnvSettings.isPrivileged,
    buildImage: AppConfig.codeBuildEnvSettings.buildImage,
    branch: repositoryStack.repositoryBranch,
    primaryOutputDirectory: AppConfig.codeBuildEnvSettings.synthOutputDirectory,
    pipelineVariables: {
      ...repositoryStack.pipelineEnvVars,
      PROXY_SECRET_ARN: AppConfig.proxy?.proxySecretArn ?? '',
    },
    codeGuruScanThreshold: AppConfig.codeGuruScanThreshold,
    vpcProps: (vpcStack.vpc ? {
      vpc: vpcStack.vpc,
      proxy: AppConfig.proxy,
    } : undefined),
  },
  complianceLogBucketName: AppConfig.complianceLogBucketName,
});

cdk.Tags.of(app).add('Application', `${AppConfig.applicationName}`);
cdk.Aspects.of(app).add(
  new SecurityControls(
    encryptionStack.kmsKey, STAGE.RES,
    AppConfig.logRetentionInDays,
    AppConfig.complianceLogBucketName.RES,
  ),
);
cdk.Aspects.of(app).add(new nag.AwsSolutionsChecks({ verbose: false }));

NagUtils.addSuppressions(app);
