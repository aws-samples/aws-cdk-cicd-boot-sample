"""
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: MIT-0
"""

"""
This is the python code triggered in the cdk pipeline post deployment.
The script can be modified to execute pre-deploy tests which would be, e.g: Integration/Unit Testing of your code
This env var is defined in the `lib/pipeline-stack.ts`
"""
import logging
import os

 # Appropriate logging
LOGGER = logging.getLogger()
LOGGER.setLevel(logging.INFO)
# Update to INFO level for trouble shooting in case
logging.getLogger('boto3').setLevel(logging.INFO)
logging.getLogger('botocore').setLevel(logging.INFO)

def perform_tests(stage,region=None):
    if not region:
        region = os.environ["AWS_REGION"]
        LOGGER.info(f"Region is not defined, using the region from codebuild environment {region}")

    ### Do some tests with the acquired session
    LOGGER.info(stage)
    LOGGER.info(region)

if __name__ == '__main__':
    stage = os.environ.get("STAGE")
    region = os.environ.get("TARGET_REGION")

    perform_tests(stage,region)