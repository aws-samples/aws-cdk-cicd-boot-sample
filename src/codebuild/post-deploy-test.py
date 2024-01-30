"""
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: MIT-0
"""

"""
This is the python code triggered in the cdk pipeline post deployment.
For describing all the log groups in the target account and add log log_groups definition.
The scripts assumes a role that is created in the `lib/test-role.ts` and the role name is passed as env var;
This env var is defined in the `lib/cdk-pipeline/core/PostDeployBuildStep.ts`
"""
import boto3
from botocore.config import Config
import logging
import os

 # Appropriate logging
LOGGER = logging.getLogger()
LOGGER.setLevel(logging.INFO)
# Update to INFO level for trouble shooting in case
logging.getLogger('boto3').setLevel(logging.INFO)
logging.getLogger('botocore').setLevel(logging.INFO)

# Using a role created for the log log_groups operation
target_role_arn = os.environ.get("LOG_RETENTIONS_ROLE")

def perform_tests(stage,region=None):

    if not region:
        region = os.environ["AWS_REGION"]
        LOGGER.info(f"Region is not defined, using the region from codebuild environment {region}")

    ### Do some fixes with the acquired session
    print(stage)
    print(region)

if __name__ == '__main__':
    stage = os.environ.get("STAGE")
    region = os.environ.get("TARGET_REGION")

    perform_tests(stage,region)
