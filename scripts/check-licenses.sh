#!/bin/bash
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved. SPDX-License-Identifier: MIT-0

set -e

################################################################################
#### Configuration Section
################################################################################

CURRENT_PATH=`pwd`;
SCRIPT=$(readlink -f $0);
SCRIPTPATH=`dirname $SCRIPT`;
PROJECT_ROOT="${SCRIPTPATH}/..";
NOTICE_FILE="$PROJECT_ROOT/NOTICE";
SUMMARY_FILE="$PROJECT_ROOT/OSS_License_Summary.csv";

CONFIG_FILE="$PROJECT_ROOT/licensecheck.json";

NPM_LICENSE_CHECKER_TOOL=license-checker-rseidelsohn;
PYTHON_LICENSE_CHECKER_TOOL=pip-licenses;

################################################################################
#### END Configuration Section
################################################################################

ME=$(basename "$0");
DATETIME=$(date "+%Y-%m-%d-%H-%M-%S");

# omit the -p parameter to create a temporal directory in the default location
WORK_DIR=`mktemp -d`;
INSTALL_LOG=$WORK_DIR/license-check.log;

# check if tmp dir was created
if [[ ! "$WORK_DIR" || ! -d "$WORK_DIR" ]]; then
    echo "Could not create temp dir";
    exit 1;
fi

# deletes the temp directory
function cleanup {
    if [ -z "$debug" ]; then
        if [ -z "$inconsistency" ]; then
            rm -rf "$WORK_DIR";
            echo "Deleted temp working directory $WORK_DIR";
        else
            echo "Temp dir $WORK_DIR is left because inconsistency found.";
        fi
    else
        echo "Temp dir $WORK_DIR is left because debug mode activeated. Please remove it once you do not need.";
    fi
}

trap cleanup EXIT;

################################################################################
# Usage
################################################################################

function usage {
    returnCode="$1";
    echo -e "\nCICD Boot License checker and Notice generation tool!";
    echo -e "\n";
    echo -e "Usage: $ME [-h][-d][-u]:
    [-h]\t\t displays help (this message)
    [-d]\t\t activates debug invormation
    [-u]\t\t update the NOTICE File";
    exit "$returnCode";
}

############################################################
# Import dependencies                                      #
############################################################
# source $SCRIPTPATH/lib/check-dependencies.sh

############################################################
# Debug information                                      #
############################################################
# debug_variables() print all script global variables to ease debugging
debug_variables() {
    echo "USERNAME: $USERNAME";
    echo "SHELL: $SHELL";
    echo "BASH_VERSION: $BASH_VERSION";
    echo "UPDATE_NOTICE: $UPDATE_NOTICE";
    echo "WORK_DIR: $WORK_DIR";
    echo "INSTALL_LOG: $INSTALL_LOG";
    echo "NPM_LICENSE_CHECKER_TOOL: $NPM_LICENSE_CHECKER_TOOL";
    echo "PYTHON_LICENSE_CHECKER_TOOL: $PYTHON_LICENSE_CHECKER_TOOL";
    echo
    echo "FAIL_ON_LICENSE_TYPES: $FAIL_ON_LICENSE_TYPES";
    echo "PACKAGE_JSONS: $PACKAGE_JSONS";
    echo "EXCLUDED_JSONS: $EXCLUDED_JSONS";

}

############################################################
# NPM section                                              #
############################################################

function check_npm_package_jsons() {
    echo "Checking NPM packages ..." | tee -a "$INSTALL_LOG";
    PACKAGE_JSONS=`find . -type f -name package.json -not -path "*/node_modules/*" -not -path "*/cdk.out/*"`;

    EXCLUDED_JSONS=`jq -r .npm.excludedSubProjects ${CONFIG_FILE}`;

    for PKG in $PACKAGE_JSONS
    do

        if [[ $EXCLUDED_JSONS == *$PKG* ]]; then
            echo "$PKG check is excluded ..." | tee -a "$INSTALL_LOG";
            continue;
        fi

        PKG_DIR=`dirname $PKG`;

        check_npm_package "$PKG_DIR";

    done

    cd "$CURRENT_PATH";
}

function check_npm_package() {
    echo "Checking NPM package $1" | tee -a "$INSTALL_LOG";
    cd $1;

    echo "Running npm ci on the $1, to have all the Licenses available locally." | tee -a "$INSTALL_LOG";
    npm ci >> "$INSTALL_LOG";

    if [ ! -z "$FAIL_ON_LICENSE_TYPES" ]; then
        if ! npx -y $NPM_LICENSE_CHECKER_TOOL --failOn $FAIL_ON_LICENSE_TYPES >> "$INSTALL_LOG"; then
            echo "Module $1 failed the license check. It containes dependency with banned license.";
            exit 1;
        fi
    fi

    NOTICE_SUFFIX=`echo $1 | tr / -`;
    TMP_NOTICE="$WORK_DIR/NOTICE.npm.$NOTICE_SUFFIX";
    TMP_NOTICE_SUM="$WORK_DIR/OSS_License_summary.npm.$NOTICE_SUFFIX";
    EXCLUDED_PACKAGES=`jq -r '.npm.excluded // [] | join(";")' ${CONFIG_FILE}`;

    echo "Packages excluded from NPM license scan: ${EXCLUDED_PACKAGES}" | tee -a "$INSTALL_LOG";

    if [[ ! -z $EXCLUDED_PACKAGES ]]; then
        npx -y $NPM_LICENSE_CHECKER_TOOL --plainVertical --excludePackages ${EXCLUDED_PACKAGES} > "$TMP_NOTICE";
    else
        npx -y $NPM_LICENSE_CHECKER_TOOL --plainVertical > "$TMP_NOTICE";
    fi

    echo "#########################" > "$TMP_NOTICE_SUM";
    echo "# Node Module: \"$1\"" >> "$TMP_NOTICE_SUM";
    echo "#########################" >> "$TMP_NOTICE_SUM";
    echo "\"License\",\"Count\"" >> "$TMP_NOTICE_SUM";
    npx -y $NPM_LICENSE_CHECKER_TOOL --summary --csv | tail -n +2 | awk -F',' '{print $2}' | sort | uniq -c | sed 's/^ *//g' | sed 's/ /\, /' | awk -F', "' '{print "\""$2",\""$1"\""}' >> "$TMP_NOTICE_SUM";

    cd "$CURRENT_PATH";
}

############################################################
# PYTHON section                                              #
############################################################

function check_python_requirements() {
    echo "Checking Python packages ..." | tee -a "$INSTALL_LOG";
    # NPM dependencies in node_modules can have python dependencies. Ignore those.
    REQUIREMENTS=`find . -type f -name Pipfile -not -path "*/node_modules/*" -not -path "*/cdk.out/*"`;

    VENV_DIR="$WORK_DIR/python-venv";

    echo "Creating vENV at $VENV_DIR" | tee -a "$INSTALL_LOG";

    python3 -m venv $VENV_DIR >> "$INSTALL_LOG";
    source $VENV_DIR/bin/activate >> "$INSTALL_LOG";
    export PIPENV_IGNORE_VIRTUALENVS=1;

    pip install --upgrade pip >> "$INSTALL_LOG";
    pip install $PYTHON_LICENSE_CHECKER_TOOL pipenv >> "$INSTALL_LOG";

    EXCLUDED_JSONS=`jq -r .python.excludedSubProjects ${CONFIG_FILE}`;

    for PKG in $REQUIREMENTS
    do
        if [[ $EXCLUDED_JSONS == *$PKG* ]]; then
            echo "$PKG check is excluded ..." | tee -a "$INSTALL_LOG";
            continue;
        fi

        PKG_DIR=`dirname $PKG`;
        pushd "${PKG_DIR}";
        check_python_module "$PKG_DIR";
        popd;
    done

    deactivate >> "$INSTALL_LOG";
    cd "$CURRENT_PATH";
}

function check_python_module() {
    echo "Checking Python module $1" | tee -a "$INSTALL_LOG";

    SUFFIX=`echo $1 | tr / -`;

    pipenv sync >> "$INSTALL_LOG";

    PIPENV_VENV=`pipenv --venv`;

    if [ ! -z "$FAIL_ON_LICENSE_TYPES" ]; then
        if ! $PYTHON_LICENSE_CHECKER_TOOL --python="$PIPENV_VENV/bin/python" --fail-on='$FAIL_ON_LICENSE_TYPES' >> "$INSTALL_LOG" ; then
            echo "Module $1 failed the license check. It containes dependency with banned license.";
            exit 1;
        fi
    fi
    TMP_NOTICE="$WORK_DIR/NOTICE.pip.$SUFFIX";
    TMP_NOTICE_SUM="$WORK_DIR/OSS_License_summary.pip.$SUFFIX";

    $PYTHON_LICENSE_CHECKER_TOOL --python="$PIPENV_VENV/bin/python" --format=plain-vertical --with-license-file --no-license-path > "$TMP_NOTICE";

    echo "#########################" > "$TMP_NOTICE_SUM";
    echo "# Python Module: \"$1\"" >> "$TMP_NOTICE_SUM";
    echo "#########################" >> "$TMP_NOTICE_SUM";
    $PYTHON_LICENSE_CHECKER_TOOL --python="$PIPENV_VENV/bin/python" --summary -f csv | awk -F"," '{print $2","$1}' >> "$TMP_NOTICE_SUM";
}

################################################################################
# Notices consistency
################################################################################
function create_holistic_notice() {
    echo "Merging files: NOTICE of NPM and Python ..." | tee -a "$INSTALL_LOG";

    FILES=`find "$WORK_DIR" -type f -iname "NOTICE.*" | sort`;

    echo "$FILES";

    for f in $FILES
    do
        cat $f >> "$1";
    done
}

function create_holistic_summary() {
    echo "Merging files: OSS_License_summary of NPM and Python ..." | tee -a "$INSTALL_LOG";

    FILES=`find "$WORK_DIR" -type f -iname "OSS_License_summary.*" | sort`;

    echo "$FILES";

    for f in $FILES
    do
        cat $f >> "$1";
    done
}

function check_notice_consistency() {
    NEW_NOTICE_FILE="$WORK_DIR/NOTICE";

    create_holistic_notice "$NEW_NOTICE_FILE";

    NEW_SUMMARY_FILE="$WORK_DIR/OSS_License_summary";
    create_holistic_summary "$NEW_SUMMARY_FILE";

    if diff -qw "$NOTICE_FILE" "$NEW_NOTICE_FILE"; then
        echo "$NOTICE_FILE is up to date!" | tee -a "$INSTALL_LOG";

        cat "$NEW_SUMMARY_FILE" | tee -a "$INSTALL_LOG";
    else
        echo "$NOTICE_FILE is not up to date!" | tee -a "$INSTALL_LOG";
        if [ ! -z "$UPDATE_NOTICE" ]; then
            echo "Updating $NOTICE_FILE" | tee -a "$INSTALL_LOG";
            cp -rf "$NEW_NOTICE_FILE" "$NOTICE_FILE";
            echo "Updating $SUMMARY_FILE" | tee -a "$INSTALL_LOG";
            cp -rf "$NEW_SUMMARY_FILE" "$SUMMARY_FILE";
        else
            echo "Diff is: " | tee -a "$INSTALL_LOG";
            diff -w "$NOTICE_FILE" "$NEW_NOTICE_FILE" | tee -a "$INSTALL_LOG";
            echo "Check the log $INSTALL_LOG for more details" | tee -a "$INSTALL_LOG";
            inconsistency=true;
            exit 1;
        fi
    fi
}

################################################################################
# MAIN
################################################################################

while getopts "hdu" opt; do
    case $opt in
    h)
        usage 0
        ;;
    d)
        debug=true
        ;;
    u)
        UPDATE_NOTICE=true
        ;;
    *)
        echo "Invalid option: -$OPTARG"
        usage 1
        ;;
    esac
done

# check_dependencies

FAIL_ON_LICENSE_TYPES=`jq -r ".failOnLicenses | join(\";\")" ${CONFIG_FILE}`;

echo "Scanning for licenses in dependencies";

check_npm_package_jsons;
check_python_requirements;
check_notice_consistency;

if [ ! -z "$debug" ]; then
    debug_variables;
fi
