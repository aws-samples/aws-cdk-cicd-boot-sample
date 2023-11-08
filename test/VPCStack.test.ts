// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { TestAppConfig } from './TestConfig';
import { IVpcConfig } from '../config/VpcConfig';
import { VPCStack } from '../lib/stacks/core/VPCStack';

describe('vpc-stack-test-with-proxy', () => {
  const app = new cdk.App();

  const vpcConfig: IVpcConfig = {
    type: 'VPC',
    VPC: {
      cidrBlock: '172.31.0.0/20',
      subnetCidrMask: 24,
      maxAzs: 2,
    },
  };

  const vpcStack = new VPCStack(app, 'VPCStack', {
    env: { account: TestAppConfig.deploymentAccounts.RES, region: TestAppConfig.region },
    vpcConfig: vpcConfig,
    proxy: {
      proxySecretArn: 'dummy_secret',
      noProxy: ['eu-west-1.amazonaws.com'],
      proxyTestUrl: 'https://docs.aws.amazon.com',
    },
    flowLogsBucketName: TestAppConfig.complianceLogBucketName.RES,
  });

  const template = Template.fromStack(vpcStack);

  test('Check if VPC exists', () => {
    template.resourceCountIs('AWS::EC2::VPC', 1);
    template.hasResourceProperties('AWS::EC2::VPC', {
      CidrBlock: vpcConfig.VPC?.cidrBlock,
    });
  });

  test('Check if Subnets exist', () => {
    template.resourceCountIs('AWS::EC2::Subnet', 2);
    template.hasResourceProperties('AWS::EC2::Subnet', {
      CidrBlock: `${vpcConfig.VPC?.cidrBlock.substring(0, 11)}${vpcConfig.VPC?.subnetCidrMask}`,
    });
  });

  test('Check if VPC Endpoints exist', () => {
    template.resourceCountIs('AWS::EC2::VPCEndpoint', 7);
    [
      'ssm',
      'sts',
      'logs',
      'cloudformation',
      'secretsmanager',
    ].forEach(service => {
      template.hasResourceProperties('AWS::EC2::VPCEndpoint', {
        ServiceName: `com.amazonaws.${TestAppConfig.region}.${service}`,
      });
    });
  });

  test('Check if SecurityGroup exists', () => {
    template.resourceCountIs('AWS::EC2::SecurityGroup', 1);
    template.hasResourceProperties('AWS::EC2::SecurityGroup', {
      SecurityGroupEgress: [{
        CidrIp: '0.0.0.0/0',
      }],
    });
  });
});

describe('vpc-stack-test-without-proxy', () => {
  const app = new cdk.App();

  const vpcConfig: IVpcConfig = {
    type: 'VPC',
    VPC: {
      cidrBlock: '172.31.0.0/20',
      subnetCidrMask: 24,
      maxAzs: 2,
    },
  };

  const vpcStack = new VPCStack(app, 'VPCStack', {
    env: { account: TestAppConfig.deploymentAccounts.RES, region: TestAppConfig.region },
    vpcConfig: vpcConfig,
    flowLogsBucketName: TestAppConfig.complianceLogBucketName.RES,
  });

  const template = Template.fromStack(vpcStack);

  test('Check if VPC exists', () => {
    template.resourceCountIs('AWS::EC2::VPC', 1);
    template.hasResourceProperties('AWS::EC2::VPC', {
      CidrBlock: vpcConfig.VPC?.cidrBlock,
    });
  });

  test('Check if Subnets exist', () => {
    template.resourceCountIs('AWS::EC2::Subnet', 4);
    template.hasResourceProperties('AWS::EC2::Subnet', {
      CidrBlock: `${vpcConfig.VPC?.cidrBlock.substring(0, 11)}${vpcConfig.VPC?.subnetCidrMask}`,
    });
  });
});

describe('vpc-stack-test-omission', () => {
  const app = new cdk.App();

  const vpcConfig: IVpcConfig = {
    type: 'NO_VPC',
  };

  const template = Template.fromStack(
    new VPCStack(app, 'VPCStack', {
      env: { account: TestAppConfig.deploymentAccounts.RES, region: TestAppConfig.region },
      vpcConfig,
      flowLogsBucketName: TestAppConfig.complianceLogBucketName.RES,
    }));

  test('Check if VPC is omitted', () => {
    template.resourceCountIs('AWS::EC2::VPC', 0);
  });

  test('Check if SecurityGroup is omitted', () => {
    template.resourceCountIs('AWS::EC2::SecurityGroup', 0);
  });

  test('Check if VPC Endpoints are omitted', () => {
    template.resourceCountIs('AWS::EC2::VPCEndpoint', 0);
  });
});