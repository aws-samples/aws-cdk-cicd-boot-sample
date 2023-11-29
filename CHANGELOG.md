# Change Log
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/)
and this project adheres to [Semantic Versioning](http://semver.org/).

## [Released]

## [1.1.1] - 2023-11-29done
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
