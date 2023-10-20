// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import * as cdk from 'aws-cdk-lib';
import { aws_s3 } from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
import { AppConfig } from '../../../config/AppConfig';
import { IVpcConfig } from '../../../config/VpcConfig';

interface Props extends cdk.StackProps {
  vpcConfig: IVpcConfig;
  proxy?: {
    noProxy: string[];
    proxySecretArn: string;
    proxyTestUrl: string;
  };
}
export class VPCStack extends cdk.Stack {
  readonly vpc: ec2.IVpc | undefined;

  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id, props);

    switch (props.vpcConfig.type) {
      case 'NO_VPC':
        break;

      case 'VPC_FROM_LOOK_UP':
        this.vpc = ec2.Vpc.fromLookup(this, 'vpc', {
          vpcId: props.vpcConfig.VPC_FROM_LOOK_UP?.vpcId,
        });
        break;

      case 'VPC':
        if (props.proxy?.proxySecretArn) {
          this.vpc = this.launchVPCIsolated(props);
        } else {
          this.vpc = this.launchVPCWithEgress(props);
        }
        break;

    }
  }

  private launchVPCIsolated(props: Props) {
    const cidr = props.vpcConfig.VPC?.cidrBlock || '';
    const subnetMask = props.vpcConfig.VPC?.subnetCidrMask;
    const vpc = new ec2.Vpc(this, 'vpc', {
      ipAddresses: ec2.IpAddresses.cidr(cidr),
      restrictDefaultSecurityGroup: true,
      subnetConfiguration: [{
        cidrMask: subnetMask,
        name: 'private-isolated',
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      }],
      maxAzs: props.vpcConfig.VPC?.maxAzs,
    });

    const vpcFlowLogsDestinationS3 = aws_s3.Bucket.fromBucketName(this, 'vpcFlowLogsBucket', AppConfig.complianceLogBucketName.RES);
    vpc.addFlowLog('vpcFlowLogs', {
      destination: ec2.FlowLogDestination.toS3(vpcFlowLogsDestinationS3),
      trafficType: ec2.FlowLogTrafficType.ALL,
    });

    const securityGroup = new ec2.SecurityGroup(this, 'SecurityGroup', {
      vpc: vpc,
      description: 'Allow traffic between CodeBuildStep and AWS Service VPC Endpoints',
      securityGroupName: 'Security Group for AWS Service VPC Endpoints',
      allowAllOutbound: true,
    });
    securityGroup.addIngressRule(ec2.Peer.ipv4(vpc.vpcCidrBlock), ec2.Port.tcp(443), 'HTTPS Traffic');

    [ //VpcEndpoints
      ec2.InterfaceVpcEndpointAwsService.SSM,
      ec2.InterfaceVpcEndpointAwsService.STS,
      ec2.InterfaceVpcEndpointAwsService.CLOUDWATCH_LOGS,
      ec2.InterfaceVpcEndpointAwsService.CLOUDFORMATION,
      ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER,
    ].forEach((service: ec2.InterfaceVpcEndpointAwsService) => {
      vpc!.addInterfaceEndpoint(`VpcEndpoint${service.shortName}`, {
        service,
        open: false,
        securityGroups: [securityGroup],
      });
    });

    // VPCGatewayEndpoints
    vpc.addGatewayEndpoint('VpcGatewayS3', {
      service: ec2.GatewayVpcEndpointAwsService.S3,
    });

    return vpc;
  }

  private launchVPCWithEgress(props: Props) {
    const cidr = props.vpcConfig.VPC?.cidrBlock || '';
    const subnetMask = props.vpcConfig.VPC?.subnetCidrMask;
    const vpc = new ec2.Vpc(this, 'vpc', {
      ipAddresses: ec2.IpAddresses.cidr(cidr),
      restrictDefaultSecurityGroup: true,
      subnetConfiguration: [{
        cidrMask: subnetMask,
        name: 'private-egress',
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      {
        cidrMask: subnetMask,
        name: 'public',
        subnetType: ec2.SubnetType.PUBLIC,
      }],
      maxAzs: props.vpcConfig.VPC?.maxAzs,
    });

    const vpcFlowLogsDestinationS3 = aws_s3.Bucket.fromBucketName(this, 'vpcFlowLogsBucket', AppConfig.complianceLogBucketName.RES);
    vpc.addFlowLog('vpcFlowLogs', {
      destination: ec2.FlowLogDestination.toS3(vpcFlowLogsDestinationS3),
      trafficType: ec2.FlowLogTrafficType.ALL,
    });

    return vpc;
  }
}
