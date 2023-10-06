# Change Log
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/)
and this project adheres to [Semantic Versioning](http://semver.org/).

## [Released]

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
