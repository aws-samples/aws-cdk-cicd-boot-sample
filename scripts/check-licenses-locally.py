#!/usr/bin/env python3
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved. SPDX-License-Identifier: MIT-0
import sys
import subprocess
import pathlib

PROJECT_ROOT = pathlib.Path(__file__).parent.parent

DOCKER_COMMAND='docker'
DOCKER_IMG='aws/codebuild/standard:7.0'
DOCKERFILE_DIR=PROJECT_ROOT / 'utils' / 'license-checker'

image = subprocess.run([DOCKER_COMMAND, 'images', '-q', DOCKER_IMG], check=True, capture_output = True, text = True)

if image.stdout == '':
    print(f"Docker image is missing: {DOCKER_IMG}")
    print(f"Building...{DOCKERFILE_DIR}")
    subprocess.run([DOCKER_COMMAND, 'build', '-t', DOCKER_IMG, DOCKERFILE_DIR], check=True)

subprocess.run([DOCKER_COMMAND, 'run', '-ti', '--rm', '--name', 
                'dpp-harvesting-vanilla-license-checker', 
                '--entrypoint', '', '-v', f'{PROJECT_ROOT}:/usr/local/app', 
                '-w', '/usr/local/app', DOCKER_IMG, 'bash', '-c', f"./scripts/check-licenses.sh {' '.join(sys.argv[1:])}"], check=True)