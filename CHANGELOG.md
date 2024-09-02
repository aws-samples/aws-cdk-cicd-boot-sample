# Change Log
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/)
and this project adheres to [Semantic Versioning](http://semver.org/).

## [Released]

## [1.2.3] - 2024-09-02

This is a bugfix release. Please check below the fixed items.

### Added
### Changed
- Remove redundant aspect (not needed anymore as the @cloudcomponents packages now support NODEJS >= 16)
- Updated CDK version to 2.155.0
- Updated 3rd party NPM libraries version
- Switched to Node 22.x
### Fixed
- Licence Checker, pinned the version to previous working version (4.3.0)

## [1.2.2] - 2024-05-16

This is a bugfix release. Please check below the fixed items.

### Added
- Pre-commit hook verifies existence of mandatory environment variables
### Changed
- Updated CDK version to 2.140.0
- Updated 3rd party NPM libraries version
### Fixed
- Docker builds to go through VPC Proxy properly when Proxy is bind behind the VPC (DPP Outbound Proxy)
- Fixed IAM Resource Policy of the KMS Key used in the MonitoringStack which is used for publishing alerts to SNS
- Fixed husky pre-commit hook to allow upgrade to its latest version 9.x.x

## [1.2.1] - 2024-03-06

In this release we introduced the ability to customize and extend the list of available deployment stages. On top of the existing stages, you are allowed to define other stages differently from each other to support use cases where stages are not unified. We have also enabled AWS SSM ParameterStore to lookup for VPC ids stored there instead of passing them as plain text. Various bugfixes were also applied. **Please make sure to manually deploy the PipelineStack in your RES account as the CodeBuild Synth phase shell was changed from `sh` to `bash`, you can always refer to the instructions present in the README.md on how to run the ```cdk deploy``` command locally.**


### Added
- Support for extending deployment stages e.g: PRE_PROD and PROD
- Support for different Stage definitions
- Allow definition of RES stage to provision shared resources like Amazon ECR repositories
- Support for looking up VPC IDs stored in SSM ParameterStore parameters for `VPC_FROM_LOOK_UP` VPC type
### Changed
- Changed shell for the CodeBuild Synth phase from `sh` to `bash`
- Updated CDK version to 2.131.0
- Updated 3rd party NPM libraries version
### Fixed
- Addressed minor issues according to the internal security review findings
- NPM `package.json` files are ignored in `node_modules` folders even in sub-folders
- Fixed exit code in the `audit:deps:python` when having vulnerability findings
- Switched assert with expect in test files
- Remove duplicate retain policy in the aspects(by default is destroy in the s3 construct)

## [1.2.0] - 2024-02-13

In this release we have automated the process of creating S3 Compliance Buckets. We have also done minor refactoring to the way how we track the CDK code for security findings using CDK NAG Tool as well as resolved a minor CVE finding. Please refer to the README and perform a manual deployment to have the `ComplianceLogBucketStack` deployed into your RES account.

### Added
### Changed
- Swapped the manual creation of compliance log buckets from bash (`create_compliance_log_bucket`) to using CDK Stack: `ComplianceLogBucketStack`.
- Removed stack level CDK NAG suppressions where applicable.
- Updated CDK version to 2.127.0
- Updated 3rd party NPM libraries version
### Fixed
- Addressed CVE-2023-50782 in the Common Lambda Layer code: `src/lambda-layer/common/Pipfile`
- Fixed exit code in the `audit:deps:python` when having vulnerability findings

## [1.1.4] - 2024-01-30

In this release we have included bugfixes, 3rd party dependency updates and also refactored the License checking. To cleanup the non-used docker image for the license checker, please run the following command `docker rmi aws/codebuild/standard:7.0` and then re-run `npm run audit:fix:license` and follow the steps in the README.md.

### Added
- Allowed modifying the location of the synthesized stacks with the `primaryOutputDirectory` attribute. This allows the CICD Boot to be placed into a subdirectory in a repository. That results in a cleaner directory structure where the root directory can focus on the business problem, while the CICD Boot will be present only as a sidecar and enable the CI/CD process.
### Changed
- Removed outdated S3 Resource Policy enforcements (`DenyUnEncryptedObjectUploads`) from bin/aspects.ts. This is handled from Amazon S3, [here](https://docs.aws.amazon.com/AmazonS3/latest/userguide/default-encryption-faq.html) the official documentation (all new objects are automatically encrypted by default).
- Removed `fix_log_groups` from src/codebuild/post-deploy-fixes.py as this is only Porsche EPO specific and doesn't apply to all the other EPOs.
- License checking has been reworked to improve developer experience. The license only needs to be regenerated when new dependencies are introduced to either NPM or any Python package. It is determined by the change on the file. If the files are untouched the license checker will assume the dependencies are not changed and pass successfully.
- License checking is no longer depending on Docker images, the licenses are generated based on the environment the script is executed. It is recommended to generate the NOTICE file on an environment that is close to the desired target environment in case you are looking for the precise results. **Note**: List of dependencies can be different based on OS and CPU architecture types.
- License checking supports `requirements.txt` files from now as well. It is recommended to be as specific as possible with your dependency versions. Overall the recommendation is to use `Pipenv` over the `requirements.txt`.
- Scripts have been modified to assume that the `PROJECT_ROOT` is the `CWD` directory instead of the parent folder of the `scripts` folder. This allows the VP to be placed into a subfolder in a repository.
- Updated the 3rd party NPM library versions to latest
### Fixed
- Issue with python dependency check script on multi lambda layers structure
- Issue with the license checker in using amd64 platform

## [1.1.3] - 2023-12-14
In this release we have included bugfixes, updates to README as well as refreshed the local environment requirements and all the packages in the package.json and in the lambda layers to the latest available versions. We have also introduced a way how to override the minimum required version of NodeJS for some libraries we have a hard depdendency on and do not have yet the latest NodeJS in use.

### Added
- ```CodeCommitRepositoryAspects``` to override the NodeJS version for the Lambdas and the CustomResources deployed by the ```CodeCommitRepositoryConstruct``` to ```NODEJS_16_X```. Important to know is that NODEJS_16_X which will be deprecated (phase 1) on Jun 12, 2024 as per official documentation [here](https://docs.aws.amazon.com/lambda/latest/dg/lambda-nodejs.html). Check under **Known Issues** for more information regarding the **CodeCommitRepositoryConstruct: NODEJS_16_X support**
### Changed
- Updated local environment version requirements for docker, node, npm, python
- Updated ```scripts/proxy.sh``` to error out in case of any unhandled exceptions
- Wrapped up all the cdk commands to run from the shipped cdk version in the package.json (e.g: `npm run cdk`)
### Fixed
- `scripts/check-deps-python.sh` checks now all the folders that contains valid Python dependency definitions, not only the src/lambda-layer/common folder
- `scripts/check-code-scan-security.sh` local execution of scan execution with out silent mode for improved troubleshooting experience
- typo in wrapper script `scripts/cdk-synth-no-lookup.sh`

## [1.1.2] - 2023-11-29
In this release we have included bugfixes.

### Added
### Changed
### Fixed
- Issue in the PipelineStack tests when adding a stack deploying SecretsManager secrets. Namespaced all the template stack identifiers as well to avoid potential crashes during new resource creations
- Enforce use of latest [pip](https://pypi.org/project/pip/) version in the Security Scans

## [1.1.1] - 2023-11-29
In this release we have included bugfixes, small updates to README as well as changed the Github Workflow to use cdk synth without lookup.

### Added
### Changed
- Use cdk synth --no-lookup (scripts/cdk-synth-no-lookup.sh) in the Github Workflows. This helps the forks which are using [Amazon VPC](https://docs.aws.amazon.com/de_de/vpc/latest/userguide/what-is-amazon-vpc.html) remove the need to connect their Github repo to the AWS Account where the VPC is living. Instead, the lookup will still run in the CodePipeline steps as before.
### Fixed
- Commit message for the initialization of the downstream with CodeCommit in accordance with the conventional commits convention.
- Bump cryptography from 41.0.4 to 41.0.6 in /src/lambda-layer/common which solves [CWE-476](https://cwe.mitre.org/data/definitions/476.html)

## [1.1.0] - 2023-11-08
In this release we harden the security functionalities built into the pipeline. The newly introduced scanners ensure that not just your IaaC in TypeScript will follow the best practices but your Python and Bash scripts as well. Make sure to run ```npm ci``` after pulling this release into your existing version.
BREAKING CHANGE: You need to first destroy the MonitoringStack first and then the existing LambdaStack before promoting the changes to the stages (DEV/INT/ ...)

### Added
- Automated Security Scanning with Bandit, Semgrep, Shellcheck
### Changed
- Remediated security findings
- Reorganized package.json scripts to improve clarity on the items
### Fixed
- Added missing VPC Endpoint for KMS needed for upgrading the aws cli in the postDeploy hooks when using VPC + Proxy
- Single account deployments of all stages for the example LambdaStack by namespacing with the ```applicationName```
- Fix scripts/test.sh and scripts/configure.sh with with explicit exit on any unhandled exception

## [1.0.5] - 2023-10-23
In this release we have adjusted the VPCStack and fixed the combination of creating VPC and using it without Proxy. If you have configured ```cicdVpcType``` to VPC and want to adjust it, then you have to manually delete the VPCStack and re-deploy it manually in the RES account. You can always refer to the instructions present in the README.md on how to run the ```cdk deploy``` command locally. We have also added git commit message linting enforcing the convention specified by https://www.conventionalcommits.org. This will help to make the collaboration between team members transparent and consistent. We have included in the README.md examples of commit messages following this convention.

### Added
- Added git commit messages linting to git hooks enforcing convention specified by https://www.conventionalcommits.org
- Added enforcing for node version >=18
### Changed
### Fixed
- Fixed VPC creation by adding NAT Gateway which allows CodeBuild to download packages from remote registries for 3rd party dependencies, e.g: npm, python etc

## [1.0.4] - 2023-10-20
In this release we have done bug fixes to the ```CodeCommitRepositoryConstruct``` as well as addressed vulnerabilities in transitive dependencies. If you have configured CodeCommit as your ```repositoryType``` then please make sure to re-deploy the RepositoryStack in your RES account manually. This will update the CodeBuild Spec of the used PR Reviewer CodeBuild Project. You can always refer to the instructions present in the README.md on how to run the ```cdk deploy``` command locally.

### Added
- Added install commands CDKPipeline, Pre/Post DeployBuildSteps and CodeCommitRepositoryConstruct and ensured the commands are always run using the latest version of the awscli and boto3 sdk
### Changed
### Fixed
- Fixed CodeBuild Spec for CodeCommitRepositoryConstruct to correctly pass the ```CDK_QUALIFIER``` down to the ```./scripts/warming.sh```
- Fixed vulnerability https://github.com/advisories/GHSA-67hx-6x53-jw92 by explicitly overriding affected transitive dependency version

## [1.0.3] - 2023-10-17

In this release we have done mostly refactorings and small fixes. We refactored the KMS Key Policy created by the EncryptionStackand and also the CDKPipeline where we removed redundant environment variables as well as fixed the network connectivity through private NAT Gateway when using VPC by enabling the usage of private subnets. Please make sure to re-deploy the Encryption stack in your RES account manually in order to update the KMS Key Policy, you can always refer to the instructions present in the README.md on how to run the ```cdk deploy``` command locally.

### Added
### Changed
- Remove redundant KMS Key policy already covered by the default admin policy of the CDK Construct
- Remove redundant environment variables in the CDKPipeline
### Fixed
- Fixed the network connectivity through private NAT Gateway when using VPC by enabling the usage of private subnets as the isolated subnets do not allow that in CDK.
- Fixed vulnerability https://github.com/advisories/GHSA-67hx-6x53-jw92

## [1.0.2] - 2023-10-06

In this release we have done a small refactoring to the KMS Key Policy created by the EncryptionStack. Check in the sections below the description for this particular change. Please make sure to re-deploy the Encryption stack in your RES account manually using the instructions present in the README.md

### Added

### Changed
- Remove redundant KMS Key policy already covered by the default admin policy of the CDK Construct

### Fixed

## [1.0.1] - 2023-10-06

In this release we have done a small fix to the KMS Key Policy created by the EncryptionStack. Check in the sections below the description for this particular change. Please make sure to re-deploy the Encryption stack in your RES account manually using the instructions present in the README.md

### Added

### Changed

### Fixed
- Issue with KMS Key policy of the key created in the EncryptionStack, restrict management actions to AWS Account level

## [1.0.0] - 2023-10-05

Initial release

### Added

### Changed

### Fixed
