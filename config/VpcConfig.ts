// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

export type VpcType = 'NO_VPC' | 'VPC' | 'VPC_FROM_LOOK_UP'

export interface IVpcConfigNewVpc {
  cidrBlock: string;
  subnetCidrMask: number;
  maxAzs: number;
}

export interface IVpcConfigFromLookUp {
  vpcId: string;
}

export interface IVpcConfig {
  type: VpcType;
  VPC?: IVpcConfigNewVpc;
  VPC_FROM_LOOK_UP?: IVpcConfigFromLookUp;
}
