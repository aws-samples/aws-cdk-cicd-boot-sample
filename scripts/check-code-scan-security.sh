#!/bin/bash
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved. SPDX-License-Identifier: MIT-0

# Fail the pipeline if scans detect security issues.
set -e

################################################################################
#### Configuration Section
################################################################################
SEMGREP_VERSION="1.52.0";
SHELLCHECK_VERSION="0.9.0.6";
BANDIT_VERSION="1.7.5";

SCRIPT=$(readlink -f $0);
SCRIPTPATH=`dirname $SCRIPT`;
PROJECT_ROOT="${SCRIPTPATH}/..";

PYTHON_COMMAND="python";
if [[ "$(python3 -V)" =~ "Python 3" ]]; then
    PYTHON_COMMAND="python3";
fi
PIP_COMMAND="pip";

SHELLCHECK_SEVERITY=${SHELLCHECK_SEVERITY:-"error"};

# The list of security scanners, remove one of them if not needed/required for your usecase by updating the list
SECURITY_SCANNERS=("semgrep" "shellcheck" "bandit");

JUNIT_REPORT=${JUNIT_REPORT:-""};
################################################################################
#### END Configuration Section
################################################################################

check_command() {
    local command=$1;

    # Check if PYTHON is installed
    local is_installed=$(command -v "${command}" || true)

    if [[ -z "$is_installed" ]]; then
        echo "${command} is not installed. Security checks will not be executed"
        exit 0
    fi
}

function initalize_security_env() {
    WORK_DIR=`mktemp -d`;

    # check if tmp dir was created
    if [[ ! "$WORK_DIR" || ! -d "$WORK_DIR" ]]; then
        echo "Could not create temp dir";
        exit 1;
    fi

    # Delete the virtual env whether the script fails or not
    function cleanup {
        if [[ "$VIRTUAL_ENV" == "$WORK_DIR*" ]]; then
            deactivate
        fi

        rm -rf "$WORK_DIR";
        echo "Completed clean up";
    }

    trap cleanup EXIT;

    # CREATE a virtual env
    $PYTHON_COMMAND -m venv "$WORK_DIR/venv" > /dev/null;

    . $WORK_DIR/venv/bin/activate;

    # Upgrading local pip version in the venv
    $PYTHON_COMMAND -m pip install --upgrade pip > /dev/null;
}

function install_python_dependency() {
    local dependency=$1;
    local version=$2;

    echo "Installing ${dependency} @ ($version)...";
    if $PIP_COMMAND install -q --upgrade "$dependency"=="${version}"; then
        echo "${dependency} installed successfully";
    else
        echo "${dependency} installation failed";
        exit 1;
    fi
}

function report_location() {
    ## On CI/CD generate reports always
    if [[ -z "$JUNIT_REPORT" ]]; then
        if [ ! -z $CODEBUILD_BUILD_ID ] || [ ! -z $GITHUB_ACTIONS ]; then
            JUNIT_REPORT="ci";
        fi
    fi

    if [[ -z "$JUNIT_REPORT" ]]; then
        echo "Security scan results will be printed to the console.";
    else
        JUNIT_REPORT_FOLDER=${JUNIT_REPORT_FOLDER:-"${PROJECT_ROOT}/junit-reports"};
        mkdir -p "${JUNIT_REPORT_FOLDER}";
        echo "Security scan results will be saved to ${JUNIT_REPORT_FOLDER}";
    fi
}

function semgrep_scan() {
    install_python_dependency "semgrep" "$SEMGREP_VERSION";
    # Execute semgrep
    if [[ -z "$JUNIT_REPORT" ]]; then
        semgrep scan --config "p/default" --metrics=off --error --exclude "cdk.context.json";
    else
        if ! semgrep scan --config "p/default" --metrics=off --error --exclude "cdk.context.json" -q --junit-xml > "${JUNIT_REPORT_FOLDER}/semgrep-junit-results.xml"; then
            CHECK_FAILED=1;
        fi
    fi
}

function shellcheck_scan() {
    install_python_dependency "shellcheck-py" "$SHELLCHECK_VERSION";
    # Execute shellcheck
    if [[ -z "$JUNIT_REPORT" ]]; then
        find $PROJECT_ROOT -type f \( -name '*.sh' -o -name '*.bash' -o -name '*.ksh' -o -name '*.bashrc' -o -name '*.bash_profile' -o -name '*.bash_login' -o -name '*.bash_logout' \) \
        -not -path "*/node_modules/*" -not -path "*/cdk.out/*" \
        | xargs shellcheck -x --severity="$SHELLCHECK_SEVERITY"
    else
        if ! find $PROJECT_ROOT -type f \( -name '*.sh' -o -name '*.bash' -o -name '*.ksh' -o -name '*.bashrc' -o -name '*.bash_profile' -o -name '*.bash_login' -o -name '*.bash_logout' \) \
        -not -path "*/node_modules/*" -not -path "*/cdk.out/*" \
        | xargs shellcheck -x --severity="$SHELLCHECK_SEVERITY" -f checkstyle > "${JUNIT_REPORT_FOLDER}/shellcheck-checkstyle-results.xml"; then
            CHECK_FAILED=1;
        fi
    fi
}

function bandit_scan() {
    install_python_dependency "bandit" "$BANDIT_VERSION";
    # Execute bandit
    if [[ -z "$JUNIT_REPORT" ]]; then
        bandit -x '**node_modules/*,**cdk.out/*' -r .
    else
        if ! bandit -x '**node_modules/*,**cdk.out/*' -r -f xml -q . > "${JUNIT_REPORT_FOLDER}/bandit-junit-results.xml"; then
            CHECK_FAILED=1;
        fi
    fi
}

check_command "$PYTHON_COMMAND";
initalize_security_env;
report_location;

NUMBER_OF_CHECK_FAILED=0;
for SCAN in "${SECURITY_SCANNERS[@]}"; do
    CHECK_FAILED=0;
    echo "--- ${SCAN} Security Scan ---";
    "${SCAN}_scan"
    echo "${SCAN} completed - Status: ${CHECK_FAILED:-0}";
    NUMBER_OF_CHECK_FAILED=$((NUMBER_OF_CHECK_FAILED+CHECK_FAILED));
done

if [ $NUMBER_OF_CHECK_FAILED != 0 ]; then
    echo "Security scan failed";
    exit 1;
else
    echo "Security scan passed";
fi
