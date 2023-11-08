#!/bin/bash
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved. SPDX-License-Identifier: MIT-0

set -e

CURRENT_PATH=`pwd`
SCRIPT=$(readlink -f $0)
SCRIPTPATH=`dirname $SCRIPT`
PROJECT_ROOT=${SCRIPTPATH}/..

DOCKER_COMMAND=docker;
DOCKER_IMG=aws/codebuild/standard:7.0;
DOCKERFILE_DIR=$PROJECT_ROOT/utils/license-checker;

if [[ `$DOCKER_COMMAND images -q $DOCKER_IMG 2> /dev/null` == "" ]]; then
    echo "Docker image is missing: $DOCKER_IMG";
    echo "Building...";

    $DOCKER_COMMAND build -t $DOCKER_IMG $DOCKERFILE_DIR
fi

exec $DOCKER_COMMAND run --rm --name cicdboot-license-checker --entrypoint "" -v ${PROJECT_ROOT}:/usr/local/app -w /usr/local/app ${DOCKER_IMG} bash -c "./scripts/check-licenses.sh $*";