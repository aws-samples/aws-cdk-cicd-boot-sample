#!/usr/bin/env python3
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved. SPDX-License-Identifier: MIT-0

import os
import io
from unittest import mock
import math
import argparse
import pathlib
import sys
import json
from collections import namedtuple

# Get the project root directory
PROJECT_ROOT = pathlib.Path(__file__).parent.parent

QuestionType = namedtuple('QuestionType', ['question', 'description', 'prompt', 'env_var_name'])

class TerminalCommands:

    YELLOW = '\033[0;33m'
    CYAN = '\033[0;36m'
    GREEN = '\033[0;32m'
    RED = '\033[0;31m'
    ENDC = '\033[0m'

    @staticmethod
    def echo_equals(length = 80):
        print('=' * length, end='')
    
    @staticmethod
    def echo_title(title):
        columns = os.get_terminal_size().columns
        
        nof_equals = math.floor((columns - len(title)) / 2) - 1

        print(TerminalCommands.YELLOW, end='')
        TerminalCommands.echo_equals(nof_equals)
        print(f" {title} ", end='')
        TerminalCommands.echo_equals(nof_equals)
        print(TerminalCommands.ENDC)

    @staticmethod
    def echo_step(message: str):
        print(TerminalCommands.CYAN, end='')
        print(message, end='')
        print(TerminalCommands.ENDC)
    
    @staticmethod
    def echo_step_info(message: str):
        TerminalCommands.echo_step(f" ({message})")

    @staticmethod
    def echo_right(message: str):
        print(f"{message:>{os.get_terminal_size().columns}}", end='')

    @staticmethod
    def echo_failure():
        print(TerminalCommands.RED, end='')
        TerminalCommands.echo_right('[ FAILED ]')
        print(TerminalCommands.ENDC)

    @staticmethod
    def echo_success():
        print(TerminalCommands.GREEN, end='')
        TerminalCommands.echo_right('[ OK ]')
        print(TerminalCommands.ENDC)

    @staticmethod
    def echo_warning(message: str):
        print(TerminalCommands.YELLOW, end='')
        TerminalCommands.echo_right('[ WARNING ] ' + message)
        print(TerminalCommands.ENDC)

    @staticmethod
    def exit_with_message(message: str):
        print()
        print(message)
        print()
        sys.exit(1)

    @staticmethod
    def exit_with_failure(message: str):
        TerminalCommands.echo_failure()
        TerminalCommands.exit_with_message('FAILURE: ' + message)
        sys.exit(1)

    @staticmethod
    def read_question(question: QuestionType):
        TerminalCommands.echo_title(question.question)
        print(question.description)

        return input(question.prompt + ': ')

    @staticmethod
    def read_boolean_question(question: str, description: str = None):
        TerminalCommands.echo_title(question)
        print(description)

        return input('(y/n): ').lower() == 'y'

class ConfigureApp:
    QUESTIONARY: list[QuestionType] = [
        QuestionType('Which AWS region would you like to use?', 'AWS region for deploying the CodePipeline and application stacks.', 'region', 'AWS_REGION'),
        QuestionType('What is the RES AWS account number?', 'AWS account number for RES environment.', 'RES account', 'ACCOUNT_RES'),
        QuestionType('What is your AWS cli profile for RES environment?', 'AWS profile name for RES environment.', 'RES profile', 'RES_ACCOUNT_AWS_PROFILE'),
        QuestionType('What is the DEV AWS account number?', 'AWS account number or - (dash) in case the DEV environment is not needed.', 'DEV account', 'ACCOUNT_DEV'),
        QuestionType('What is your AWS cli profile for DEV environment?', 'AWS profile name or - (dash) in case the DEV environment is not needed.', 'DEV profile', 'DEV_ACCOUNT_AWS_PROFILE'),
        QuestionType('What is the INT AWS account number?', 'AWS account number or - (dash) in case the INT environment is not needed.', 'INT account', 'ACCOUNT_INT'),
        QuestionType('What is your AWS cli profile for INT environment?', 'AWS profile name or - (dash) in case the INT environment is not needed.', 'INT profile', 'INT_ACCOUNT_AWS_PROFILE'),
        QuestionType('Do you use HTTP proxy to reach out to resources outside of your network?', 'What is your secret arn which holds the Proxy server definition? The secret needs to define the username, password, http_proxy_port, https_proxy_port, and the proxy_domain values. Leave empty if you do not need a proxy.', 'Proxy secret arn', 'PROXY_SECRET_ARN'),
    ]

    def __init__(self, debug=False):
        self.answers: dict[str, str] = {}
        self.debug = debug

    def collect_inputs(self):

        TerminalCommands.echo_step('Collecting Information...')
        print()

        self.is_scaffolding = TerminalCommands.read_boolean_question('Creating a new CICD Boot project?', 'Do you want to create a new CICD Boot project?')

        if self.is_scaffolding:
            self.collect_inputs_for_scaffolding()
        else:
            self.read_up_data()

        for question in self.QUESTIONARY:
            self.answers[question.env_var_name] = TerminalCommands.read_question(question)

        TerminalCommands.echo_success()
        print()

    def collect_inputs_for_scaffolding(self):

        self.answers['APPLICATION_NAME'] = TerminalCommands.read_question(QuestionType('What should the name of the project be?', 'This name will be set as your application and NPM package name.', 'Application name', 'APPLICATION_NAME'))

        is_github = TerminalCommands.read_boolean_question('Using GitHub?', 'Do you want to use GitHub?')

        if is_github:
            self.collect_inputs_for_github()
        else:
            self.collect_input_for_codecommit()

        self.answers['CDK_QUALIFIER'] = TerminalCommands.read_question(QuestionType(
            'What is your desired CDK Qualifier?',
            'CDK Qualifier should be unique for the accounts in the region. You can read more about cdk qualifiers (https://docs.aws.amazon.com/cdk/v2/guide/bootstrapping.html). Length must be less than 9 characters',
            'CDK Qualifier',
            'CDK_QUALIFIER'
            ))
        
        enable_vpc = TerminalCommands.read_boolean_question('Would you like to use a VPC?', 'Do you want your project to run the pipeline within a VPC?')

        if enable_vpc:
            create_vpc = TerminalCommands.read_boolean_question('New or existing VPC?', 'Do you want to create a new VPC? (type \'No\' to re-use an existing VPC)')

            if create_vpc:
                self.answers['CICD_VPC_TYPE'] = 'VPC'
            else:
                self.answers['CICD_VPC_TYPE'] = 'VPC_FROM_LOOK_UP'
                self.answers['VPC_ID'] = TerminalCommands.read_question(QuestionType(
                    'Reusing an existing VPC',
                    'Type your VPC ID. You can find it in the VPC section of the AWS console.',
                    'VPC ID',
                    'VPC_ID'
                    ))
        else:
            self.answers['CICD_VPC_TYPE'] = 'NO_VPC'

    def collect_inputs_for_github(self):
        self.answers['REPOSITORY_TYPE'] = 'GITHUB'

        is_codestar_arn_ready = TerminalCommands.read_boolean_question('Do you know the AWS CodeStar Connection Arn?', 'AWS CodeStar Connection has to be established before the pipeline is deployed to the RES account.')

        if is_codestar_arn_ready:
            self.answers['CODESTAR_CONNECTION_ARN'] = TerminalCommands.read_question(QuestionType(
                'What is the AWS CodeStar Connection Arn?',
                'Please provide the AWS CodeStar Connection. It\'s format is arn:aws:codestar-connections:<region>:<account>:connection/<unique_id>',
                'CodeStar Connection Arn',
                'CODESTAR_CONNECTION_ARN'
                ))

            self.answers['GIT_REPOSITORY'] = TerminalCommands.read_question(QuestionType('What is the GitHub Repository name?', 'The GitHub repository name is in \'owner/name\' format. Please provide in this format.', 'Owner/Name', 'GIT_REPOSITORY'))
        else:
            TerminalCommands.echo_warning('Please check the documentation of the CICD Boot. \'${SCRIPTPATH}/../docs/prerequisites-github-codestarconnection.md\'')
            
            raise SystemError('Please provide the AWS CodeStar Connection Arn.')

    def collect_input_for_codecommit(self):
        self.answers['REPOSITORY_TYPE'] = 'CODECOMMIT'
        self.answers['GIT_REPOSITORY'] = TerminalCommands.read_question(QuestionType('What the CodeCommit Repository name should be?', 'This value is used to create your CodeCommit repository. This needs to be uniqe in the account.', 'Repository Name', 'GIT_REPOSITORY'))

    def read_up_data(self):
        TerminalCommands.echo_step('Discovering project settings...')
        print()

        with(open(PROJECT_ROOT / 'package.json', 'r', encoding = 'utf-8')) as json_file:
            package_json = json.load(json_file)

            self.answers['GIT_REPOSITORY'] = package_json['config']['repositoryName']
            TerminalCommands.echo_step_info('Git Repository: ' + self.answers['GIT_REPOSITORY'])
            print()

            self.answers['REPOSITORY_TYPE'] = package_json['config']['repositoryType']
            TerminalCommands.echo_step_info('Repository Type: ' + self.answers['REPOSITORY_TYPE'])
            print()

            self.answers['CDK_QUALIFIER'] = package_json['config']['cdkQualifier']
            TerminalCommands.echo_step_info('CDK Qualifier: ' + self.answers['CDK_QUALIFIER'])
            print()

            TerminalCommands.echo_success()
        
        if self.answers['REPOSITORY_TYPE'] == 'GITHUB':
            self.collect_inputs_for_github()

    def update_package_json(self):
        TerminalCommands.echo_step('Updating package.json...')
        print()

        with(open(PROJECT_ROOT / 'package.json', 'r+', encoding = 'utf-8')) as json_file:
            package_json = json.load(json_file)

            package_json['config'] = {
                'applicationName': self.answers['APPLICATION_NAME'],
                'repositoryName': self.answers['GIT_REPOSITORY'],
                'repositoryType': self.answers['REPOSITORY_TYPE'],
                'cdkQualifier': self.answers['CDK_QUALIFIER'],
                'cicdVpcType': self.answers['CICD_VPC_TYPE']
            }

            if 'VPC_ID' in self.answers:
                package_json['config']['cicdVpcId'] = self.answers['VPC_ID']

            json_file.seek(0)
            
            json.dump(package_json, json_file, indent=4)
        
        TerminalCommands.echo_success()
        print()
    
    def update_CDK(self):
        TerminalCommands.echo_step('Updating cdk.json...')
        print()

        with(open(PROJECT_ROOT / 'cdk.json', 'r+', encoding = 'utf-8')) as json_file:
            cdk_json = json.load(json_file)

            if not 'context' in cdk_json:
                cdk_json['context'] = {}

            cdk_json['context']['@aws-cdk/core:bootstrapQualifier'] = self.answers['CDK_QUALIFIER']
            cdk_json['toolkitStackName'] = f"CDKToolkit-{self.answers['CDK_QUALIFIER']}"

            json_file.seek(0)

            json.dump(cdk_json, json_file, indent=4)
        
        TerminalCommands.echo_success()
        print()

    def generate_environment_file(self):
        TerminalCommands.echo_step('Generating environment file...')
        print()

        if os.name == 'nt':
            with(open(PROJECT_ROOT / 'export_vars.bat', 'w', encoding = 'utf-8', newline = os.linesep)) as env_file:
                env_file.write('@echo off\n')

                env_file.write(f"set CODESTAR_CONNECTION_ARN={self.answers.get('CODESTAR_CONNECTION_ARN', '')}\n")
                
                env_file.write(f"set GIT_REPOSITORY={self.answers['GIT_REPOSITORY']}\n")
                env_file.write(f"set CDK_QUALIFIER={self.answers['CDK_QUALIFIER']}\n")

                for question in self.QUESTIONARY:
                    env_file.write(f"set {question.env_var_name}={self.answers[question.env_var_name]}\n")
                
                env_file.write('set AWS_PROFILE=%RES_ACCOUNT_AWS_PROFILE%\n')
            
            with(open(PROJECT_ROOT / 'export_vars.ps1', 'w', encoding = 'utf-8', newline = os.linesep)) as env_file:
                env_file.write(f"$Env:CODESTAR_CONNECTION_ARN = '{self.answers.get('CODESTAR_CONNECTION_ARN', '')}'\n")
                
                env_file.write(f"$Env:GIT_REPOSITORY = '{self.answers['GIT_REPOSITORY']}'\n")
                env_file.write(f"$Env:CDK_QUALIFIER = '{self.answers['CDK_QUALIFIER']}'\n")

                for question in self.QUESTIONARY:
                    env_file.write(f"$Env:{question.env_var_name} = '{self.answers[question.env_var_name]}'\n")
                
                env_file.write('$Env:AWS_PROFILE = (Get-Item env:RES_ACCOUNT_AWS_PROFILE).Value\n')

                TerminalCommands.echo_step_info(f"The 'export_vars.bat' and the 'export_vars.sh1' files can configure your environment variables.")
        else:            
            with(open(PROJECT_ROOT / 'export_vars.sh', 'w', encoding = 'utf-8', newline = os.linesep)) as env_file:
                env_file.write('#!/bin/bash\n')
                env_file.write('# Environment file generated by scripts/configure.py\n')

                env_file.write(f"export CODESTAR_CONNECTION_ARN={self.answers.get('CODESTAR_CONNECTION_ARN', '')};\n")
                
                env_file.write(f"export GIT_REPOSITORY={self.answers['GIT_REPOSITORY']};\n")
                env_file.write(f"export CDK_QUALIFIER={self.answers['CDK_QUALIFIER']};\n")

                for question in self.QUESTIONARY:
                    env_file.write(f"export {question.env_var_name}={self.answers[question.env_var_name]};\n")
                
                env_file.write('export AWS_PROFILE=${RES_ACCOUNT_AWS_PROFILE};\n')
        
            os.chmod(PROJECT_ROOT / 'export_vars.sh', 0o755)

            TerminalCommands.echo_step_info(f"To use the newly created 'export_vars.sh'. Execute the 'source export_vars.sh'")

        TerminalCommands.echo_success()
        print()

    def main(self):
        try:
            self.collect_inputs()

            if self.is_scaffolding:
                self.update_package_json()
                self.update_CDK()

            self.generate_environment_file()

            if self.debug:
                print(self.answers)

            return 0
        except Exception as ex:
            print(ex)
            if self.debug:
                print(self.answers)

            return 1


################################################################
# Testing ConfigureApp
################################################################
class TestConfigureApp:

    YES_SCAFFOLDING = 'y'
    NO_SCAFFOLDING = 'n'

    ## Scaffolding
    TEST_APPLICATION_NAME = 'testapp'
    
    GITHUB = 'y'
    YES_ARN_READY = 'y'
    TEST_CODESTAR_CONNECTION_ARN = 'arn:codestar:123243'
    TEST_GITHUB_REPOSITORY = 'github/testrepo'

    CODE_COMMIT = 'n'
    TEST_CODE_COMMIT_REPOSITORY = 'testrepo'
    
    TEST_CDK_QUALIFIER = 'testqualifier'

    NO_VPC = 'n'
    YES_USE_VPC = 'y'

    YES_NEW_VPC = 'y'
    NO_NEW_VPC = 'n'

    TEST_VPC_ID = 'vpc-123123'

    # Questionary
    AWS_REGION = 'eu-central-1'
    ACCOUNT_RES = '123456789012'
    RES_ACCOUNT_AWS_PROFILE = 'res-profile'
    ACCOUNT_DEV = '234567890123'
    DEV_ACCOUNT_AWS_PROFILE = 'dev-profile'
    ACCOUNT_INT = '345678901234'
    INT_ACCOUNT_AWS_PROFILE = 'int-profile'
    PROXY_SECRET_ARN = ''

    QUESTIONNAIRES_ANSWERS = f'{AWS_REGION}\n{ACCOUNT_RES}\n{RES_ACCOUNT_AWS_PROFILE}\n{ACCOUNT_DEV}\n{DEV_ACCOUNT_AWS_PROFILE}\n{ACCOUNT_INT}\n{INT_ACCOUNT_AWS_PROFILE}\n{PROXY_SECRET_ARN}\n'

    TESTCASE_WITHOUT_SCAFFOLDING_GITHUB = f'{NO_SCAFFOLDING}\n{YES_ARN_READY}\n{TEST_CODESTAR_CONNECTION_ARN}\n' \
        f'{TEST_GITHUB_REPOSITORY}\n{QUESTIONNAIRES_ANSWERS}'
    
    @mock.patch.object(os, 'get_terminal_size')
    @mock.patch('sys.stdin', io.StringIO(TESTCASE_WITHOUT_SCAFFOLDING_GITHUB))
    def test_without_scaffolding_github(self, mock_get_terminal_size):
        mock_get_terminal_size.return_value = os.terminal_size([250, 90])

        data_dict = {
            "cdk.json": '{"toolkitStackName": "CDKToolkit-testqualifier"}',
            "package.json": '{"config": {"repositoryName": "github/testrepo", "repositoryType": "GITHUB", "cdkQualifier": "testqualifier"} }',
            "export_vars.sh": ''
        }

        mock_dict : dict[str, mock.MagicMock] = {}

        def open_side_effect(file, *args, **kwargs):
            magic = mock.mock_open(read_data=data_dict.get(file.name, None))
            handler = magic()
            mock_dict[file.name] = handler
            return handler
        
        with mock.patch(f"{__name__}.open", side_effect=open_side_effect):
            assert ConfigureApp(True).main() == 0

            generated_variables = mock_dict['export_vars.sh']
            calls = [
                mock.call(f'export CODESTAR_CONNECTION_ARN={TestConfigureApp.TEST_CODESTAR_CONNECTION_ARN};\n'),
                mock.call(f'export GIT_REPOSITORY={TestConfigureApp.TEST_GITHUB_REPOSITORY};\n'),
                mock.call(f'export CDK_QUALIFIER={TestConfigureApp.TEST_CDK_QUALIFIER};\n'),
                mock.call(f'export AWS_REGION={TestConfigureApp.AWS_REGION};\n'),
                mock.call(f'export ACCOUNT_RES={TestConfigureApp.ACCOUNT_RES};\n'),
                mock.call(f'export RES_ACCOUNT_AWS_PROFILE={TestConfigureApp.RES_ACCOUNT_AWS_PROFILE};\n'),
                mock.call(f'export ACCOUNT_DEV={TestConfigureApp.ACCOUNT_DEV};\n'),
                mock.call(f'export DEV_ACCOUNT_AWS_PROFILE={TestConfigureApp.DEV_ACCOUNT_AWS_PROFILE};\n'),
                mock.call(f'export ACCOUNT_INT={TestConfigureApp.ACCOUNT_INT};\n'),
                mock.call(f'export INT_ACCOUNT_AWS_PROFILE={TestConfigureApp.INT_ACCOUNT_AWS_PROFILE};\n'),
                mock.call(f'export PROXY_SECRET_ARN={TestConfigureApp.PROXY_SECRET_ARN};\n'),
                mock.call('export AWS_PROFILE=${RES_ACCOUNT_AWS_PROFILE};\n')
            ]
            generated_variables.write.assert_has_calls(calls)

    TESTCASE_WITH_SCAFFOLDING_CODECOMMIT = f'{YES_SCAFFOLDING}\n{TEST_APPLICATION_NAME}\n{CODE_COMMIT}\n' \
        f'{TEST_CODE_COMMIT_REPOSITORY}\n{TEST_CDK_QUALIFIER}\n{YES_USE_VPC}\n{NO_NEW_VPC}\n{TEST_VPC_ID}\n{QUESTIONNAIRES_ANSWERS}'
    
    @mock.patch.object(os, 'get_terminal_size')
    @mock.patch('sys.stdin', io.StringIO(TESTCASE_WITH_SCAFFOLDING_CODECOMMIT))
    def test_with_scaffolding_codecommit(self, mock_get_terminal_size):
        mock_get_terminal_size.return_value = os.terminal_size([250, 90])

        data_dict = {
            "cdk.json": '{}',
            "package.json": '{"config": {"repositoryName": "github/testrepo", "repositoryType": "GITHUB", "cdkQualifier": "testqualifier"} }',
            "export_vars.sh": ''
        }

        mock_dict : dict[str, mock.MagicMock] = {}

        def open_side_effect(file, *args, **kwargs):
            magic = mock.mock_open(read_data=data_dict.get(file.name, None))
            isinstance = magic()
            mock_dict[file.name] = isinstance
            return isinstance
        
        with mock.patch(f"{__name__}.open", side_effect=open_side_effect):
            config = ConfigureApp(True)
            assert config.main() == 0

            generated_variables = mock_dict['export_vars.sh']
            calls = [
                mock.call('export CODESTAR_CONNECTION_ARN=;\n'),
                mock.call(f'export GIT_REPOSITORY={TestConfigureApp.TEST_CODE_COMMIT_REPOSITORY};\n'),
                mock.call(f'export CDK_QUALIFIER={TestConfigureApp.TEST_CDK_QUALIFIER};\n'),
                mock.call(f'export AWS_REGION={TestConfigureApp.AWS_REGION};\n'),
                mock.call(f'export ACCOUNT_RES={TestConfigureApp.ACCOUNT_RES};\n'),
                mock.call(f'export RES_ACCOUNT_AWS_PROFILE={TestConfigureApp.RES_ACCOUNT_AWS_PROFILE};\n'),
                mock.call(f'export ACCOUNT_DEV={TestConfigureApp.ACCOUNT_DEV};\n'),
                mock.call(f'export DEV_ACCOUNT_AWS_PROFILE={TestConfigureApp.DEV_ACCOUNT_AWS_PROFILE};\n'),
                mock.call(f'export ACCOUNT_INT={TestConfigureApp.ACCOUNT_INT};\n'),
                mock.call(f'export INT_ACCOUNT_AWS_PROFILE={TestConfigureApp.INT_ACCOUNT_AWS_PROFILE};\n'),
                mock.call(f'export PROXY_SECRET_ARN={TestConfigureApp.PROXY_SECRET_ARN};\n'),
                mock.call('export AWS_PROFILE=${RES_ACCOUNT_AWS_PROFILE};\n')
            ]
            generated_variables.write.assert_has_calls(calls)

            cdk_json = mock_dict['cdk.json']
            cdk = TestConfigureApp.restore_json_from_mock_write(cdk_json.write)

            assert cdk['toolkitStackName'] == f"CDKToolkit-{TestConfigureApp.TEST_CDK_QUALIFIER}"
            assert cdk['context']['@aws-cdk/core:bootstrapQualifier'] == TestConfigureApp.TEST_CDK_QUALIFIER

            package_json = mock_dict['package.json']
            package = TestConfigureApp.restore_json_from_mock_write(package_json.write)

            assert package['config']['applicationName'] == TestConfigureApp.TEST_APPLICATION_NAME
            assert package['config']['repositoryName'] == TestConfigureApp.TEST_CODE_COMMIT_REPOSITORY
            assert package['config']['repositoryType'] == 'CODECOMMIT'
            assert package['config']['cdkQualifier'] == TestConfigureApp.TEST_CDK_QUALIFIER
            assert package['config']['cicdVpcType'] == 'VPC_FROM_LOOK_UP'
            assert package['config']['cicdVpcId'] == TestConfigureApp.TEST_VPC_ID
    
    @staticmethod
    def restore_json_from_mock_write(mock_write):
        jsonstr = ''
        for call in mock_write.mock_calls:
            jsonstr += call.args[0]
        return json.loads(jsonstr)

################################################################
# END - Testing ConfigureApp
################################################################


if __name__ == '__main__':

    parser = argparse.ArgumentParser(description='CICD Boot Configuration Tool to scaffold and/or initialize local environment!')
    parser.add_argument('-d', '--debug', action='store_true', help='Enable debug logging')
    parser.add_argument('-t', '--testing', action='store_true', help='Run in testing mode')

    args = parser.parse_args()

    if args.testing:
        try:
            pytest = __import__('pytest') # Import pytest dynamically to avoid including as dependency
            sys.exit( pytest.main([f"{__file__}::TestConfigureApp"]) )
        except ImportError:
            print("ERROR: Could not import pytest")
            sys.exit(1)
    else:
        TerminalCommands.echo_success()
        sys.exit( ConfigureApp(args.debug).main() )
