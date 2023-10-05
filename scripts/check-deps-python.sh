#!/bin/bash
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved. SPDX-License-Identifier: MIT-0

##
# Make sure to add a new path to the requirements.txt in case you add a new path
# 
##
ROOT_DIR=$(pwd)
layer_folders=(
    "${ROOT_DIR}/src/lambda-layer/common"
)

echo "Scanning for vulnerabilities in dependencies in Python"

PYTHON_EXECUTABLE="python";
if [[ "$(python3 -V)" =~ "Python 3" ]]; then
    PYTHON_EXECUTABLE="python3";
fi

WORK_DIR=`mktemp -d`;

# check if tmp dir was created
if [[ ! "$WORK_DIR" || ! -d "$WORK_DIR" ]]; then
    echo "Could not create temp dir";
    exit 1;
fi

# deletes the temp directory
function cleanup {
    if [[ "$VIRTUAL_ENV" == "$WORK_DIR*" ]]; then
        deactivate
    fi

    rm -rf "$WORK_DIR";
}

trap cleanup EXIT;

# CREATE a virtual env
$PYTHON_EXECUTABLE -m venv "$WORK_DIR/venv" > /dev/null;

. $WORK_DIR/venv/bin/activate;
pip install pip-audit pipenv > /dev/null;

for layer_folder in "${layer_folders[@]}"; do
    pushd "${layer_folder}" || exit 1;
    pipenv requirements --exclude-markers --hash > requirements.txt && pip-audit -r requirements.txt --disable-pip && rm -rf requirements.txt;
    popd || exit 1;
done
