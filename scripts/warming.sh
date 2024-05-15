#!/bin/bash
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved. SPDX-License-Identifier: MIT-0

set -e

echo "The ACCOUNT_RES/ACCOUNT_DEV/ACCOUNT_INT is not set."
echo "Collecting values from the SSM Params"

echo "Getting all SSM params for the qualifier"
parameters=$(aws ssm get-parameters-by-path --path /${CDK_QUALIFIER}/ --query "Parameters[].[Name, Value]" --output text)

# Process the list of SSM parameters with values which are in teh following format:
# /qualifier/AccountDev                       123456789012
# /qualifier/AccountInt                       123456789012
# /qualifier/AccountRes                       123456789012
# /qualifier/AccountProd                      123456789012
# /qualifier/Account${YOUR_OTHER_STAGE}       123456789012

# Iterate over the list of parameters and print the values
parameter_name=;
parameter_value=;
while IFS= read -r line; do
    parameter_name=$(echo $line | awk '{print $1}');
    parameter_value=$(echo $line | awk '{print $2}');
    echo "$parameter_name: $parameter_value";

    if [[ $parameter_name =~ "Account" ]]; then
        # Get the stageName from the end of the parameter name after the Account string
        stageName=${parameter_name##*Account};

        # BACKWARD compatibility STARTS HERE
        # Make it upper case, if stage name is either Res, Dev, Int, or Prod
        if [[ $stageName == "Res" || $stageName == "Dev" || $stageName == "Int" || $stageName == "Prod" ]]; then
            stageName=$(echo $stageName | tr '[:lower:]' '[:upper:]');
        fi
        # BACKWARD compatibility ENDS HERE

        export "ACCOUNT_${stageName}"="$parameter_value";

        echo "ACCOUNT_${stageName} set to $parameter_value";
    fi
done <<< $parameters