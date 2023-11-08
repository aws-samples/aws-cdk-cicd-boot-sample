#!/bin/bash
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved. SPDX-License-Identifier: MIT-0

# This file is deprecated and only kept for backwards compatibility. Please use the new check-audit.sh for including new checks.
set -e

SCRIPT=$(readlink -f "$0")
SCRIPTPATH=`dirname "$SCRIPT"`

exec ${SCRIPTPATH}/check-audit.sh