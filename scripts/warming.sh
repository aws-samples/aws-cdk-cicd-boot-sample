#!/bin/bash

# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved. SPDX-License-Identifier: MIT-0

set -e

echo "The ACCOUNT_RES/ACCOUNT_DEV/ACCOUNT_INT is not set."
echo "Collecting values from the SSM Params"
export ACCOUNT_RES=$(aws ssm get-parameter --name /${CDK_QUALIFIER}/AccountRes --query "Parameter.Value" --output text)
export ACCOUNT_DEV=$(aws ssm get-parameter --name /${CDK_QUALIFIER}/AccountDev --query "Parameter.Value" --output text)
export ACCOUNT_INT=$(aws ssm get-parameter --name /${CDK_QUALIFIER}/AccountInt --query "Parameter.Value" --output text)
