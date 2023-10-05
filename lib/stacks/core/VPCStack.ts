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
        const cidr = props.vpcConfig.VPC?.cidrBlock || '';
        const subnetMask = props.vpcConfig.VPC?.subnetCidrMask;
        this.vpc = new ec2.Vpc(this, 'vpc', {
          ipAddresses: ec2.IpAddresses.cidr(cidr),
          availabilityZones: [`${this.region}a`, `${this.region}b`],
          restrictDefaultSecurityGroup: true,
          subnetConfiguration: [{
            cidrMask: subnetMask,
            name: 'private',
            subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          }],
        });

        const vpcFlowLogsDestinationS3 = aws_s3.Bucket.fromBucketName(this, 'vpcFlowLogsBucket', AppConfig.complianceLogBucketName.RES);
        this.vpc.addFlowLog('vpcFlowLogs', {
          destination: ec2.FlowLogDestination.toS3(vpcFlowLogsDestinationS3),
          trafficType: ec2.FlowLogTrafficType.ALL,
        });

        const securityGroup = new ec2.SecurityGroup(this, 'SecurityGroup', {
          vpc: this.vpc,
          description: 'Allow traffic between CodeBuildStep and AWS Service VPC Endpoints',
          securityGroupName: 'Security Group for AWS Service VPC Endpoints',
          allowAllOutbound: true,
        });
        securityGroup.addIngressRule(ec2.Peer.ipv4(this.vpc.vpcCidrBlock), ec2.Port.tcp(443), 'HTTPS Traffic');

        [ //VpcEndpoints
          ec2.InterfaceVpcEndpointAwsService.SSM,
          ec2.InterfaceVpcEndpointAwsService.STS,
          ec2.InterfaceVpcEndpointAwsService.CLOUDWATCH_LOGS,
          ec2.InterfaceVpcEndpointAwsService.CLOUDFORMATION,
          ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER,
        ].forEach((service: ec2.InterfaceVpcEndpointAwsService) => {
          this.vpc!.addInterfaceEndpoint(`VpcEndpoint${service.shortName}`, {
            service,
            open: false,
            securityGroups: [securityGroup],
          });
        });

        // VPCGatewayEndpoints
        this.vpc.addGatewayEndpoint('VpcGatewayS3', {
          service: ec2.GatewayVpcEndpointAwsService.S3,
        });
        break;

    }
  }
}
