// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

// ESLint must be disabled while the https://github.com/adaltas/node-csv/issues/323 has not been solved
/* eslint-disable */
import { SpawnSyncOptions, spawnSync } from 'child_process';
import { createHash } from 'crypto';
import { existsSync, mkdirSync, mkdtempSync, rmSync, readFileSync, openSync, writeFileSync, readdirSync, statSync } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { parse, stringify } from 'csv/sync';
import * as glob from 'glob';

const NPM_LICENSE_CHECKER_TOOL = 'license-checker-rseidelsohn';
const PYTHON_LICENSE_CHECKER_TOOL = 'pip-licenses';

// 5 min timeout
const GLOBAL_TIMEOUT = { timeout: 5 * 60 * 1000 };
const DEFAULT_EXCLUDED_FOLDERS = ['node_modules/**', 'cdk.out/**', '.git/**', 'dist/**', 'docs/**', 'bin/**', 'tmp/**'];

interface ScanningContext {
  readonly projectRoot: string;
  readonly workingDir: string;
  readonly pip: string;
  readonly python: string;
}

interface LicenseConfig {
  readonly failOnLicenses: string[];
  readonly npm: {
    excluded: string[];
    excludedSubProjects: string[];
  };
  readonly python: {
    allowedTypes: string[];
    excluded: string[];
    excludedSubProjects: string[];
  };
  excludeFolders: string[];
}

const VERIFICATION_FILE = './package-verification.json';
const LICENSE_FILES_SUMMARY_HASH = 'projectList';

const DEFAULT_LICENSE_FILE = {
  failOnLicenses: [
    'AGPL',
    'GNU AGPL',
    'APPLE PUBLIC SOURCE LICENSE',
    'APSL-2.0',
    'CDLA-Sharing-1.0',
    'CPAL-1.0',
    'MIT-enna',
    'EUPL-1.1',
    'EUPL-1.2',
    'LGPL-3.0-only',
    'LGPL-3.0-or-later',
    'GPL-3.0-only',
    'GPL-3.0-or-later',
    'HPL',
    'NASA-1.3',
    'ODbL-1.0',
    'OSL-3.0',
    'Parity-7.0.0',
    'RPSL-1.0',
    'SSPL-1.0',
    'BUSL-1.1',
    'Commons Clause',
    'CRAPL',
    'CC-BY-NC-1.0',
    'CC-BY-NC-2.0',
    'CC-BY-NC-2.5',
    'CC-BY-NC-3.0',
    'CC-BY-NC-4.0',
    'Elastic-2.0',
    'Hugging Face Optimized Inference',
    'HFOILv1.0',
    'Prosperity Public',
    'Redis Source Available',
    'UC Berkeley',
  ],
  npm: {
    excluded: [],
    excludedSubProjects: [],
  },
  python: {
    allowedTypes: ["Pipenv"],
    excluded: [],
    excludedSubProjects: [],
  },
};

class CliHelpers {
  static getPythonCommand() {
    // 1 min timeout
    const TIMEOUT = { timeout: 5 * 60 * 1000 };
    const python3Results = spawnSync('python3', ['-v'], {
      encoding: 'utf8',
      ...TIMEOUT,
    });

    if (python3Results.status === 0 && python3Results.output.find((line) => line?.match('.*Python 3.*'))) {
      return {
        pythonExecutable: 'python3',
        pipExecutable: 'pip3',
      };
    } else {
      const pythonResults = spawnSync('python', ['-v'], {
        encoding: 'utf8',
        ...TIMEOUT,
      });

      if (pythonResults.status !== 0) {
        console.error('Python is not installed. Security checks will not be executed');
        throw new Error('Python is not installed. Security checks will not be executed');
      }
      return {
        pythonExecutable: 'python',
        pipExecutable: 'pip',
      };
    }
  }

  static findRecursively(match: string, directory: string, excludes?: string, maxDept: number = 8) {
    const matches: string[] = [];

    function throughDirectory(dir: string, level: number = 0) {
      if (excludes && dir.match(excludes)) {
        return;
      }

      if (level > maxDept) {
        return;
      }

      readdirSync(dir).forEach((file) => {
        // Suppressed as no user input it used to manage the path and child_process
        // nosemgrep
        const absolute = path.join(dir, file);

        if (file.match(match)) {
          matches.push(absolute);
        } else if (statSync(absolute).isDirectory()) {
          throughDirectory(absolute, level + 1);
        }
      });
    }

    throughDirectory(directory, 0);

    return matches;
  }

  static generateChecksum(filePath: string) {
    const checksum = createHash('sha256');
    checksum.update(readFileSync(filePath));
    return checksum.digest('hex');
  }

  static generateChecksumForText(text: string) {
    const checksum = createHash('sha256');
    checksum.update(text);
    return checksum.digest('hex');
  }

  static persistChecksum(verificationFile: string, checksumKey: string, checksumValue: string) {
    let checkSumState: Record<string, string> = {};
    if (existsSync(verificationFile)) {
      checkSumState = JSON.parse(readFileSync(verificationFile, { encoding: 'utf8' })) as Record<string, string>;
    }

    checkSumState[checksumKey] = checksumValue;

    writeFileSync(verificationFile, JSON.stringify(checkSumState, null, 2));
  }
}

class LicenseChecker {
  readonly licenseCheckerConfiguration: LicenseConfig;

  private verificationJson: Record<string, any>; // eslint-disable-line
  private licenseSection: Record<string, string>;

  private newLicensesSection: Record<string, string> = {};

  constructor(
    readonly configFile: string = './licensecheck.json',
    readonly force: boolean = false,
    readonly fix: boolean = true,
    readonly debug: boolean = false,
  ) {
    if (!existsSync(configFile)) {
      console.log(`License checker configuration file ${configFile} does not exist. Creating one ...`);
      writeFileSync(configFile, JSON.stringify(DEFAULT_LICENSE_FILE));
    }

    this.licenseCheckerConfiguration = JSON.parse(readFileSync(configFile, { encoding: 'utf8' }));

    this.licenseCheckerConfiguration.excludeFolders = [
      ...DEFAULT_EXCLUDED_FOLDERS,
      ...(this.licenseCheckerConfiguration.excludeFolders || []),
    ];

    this.licenseCheckerConfiguration.python.allowedTypes = [
      ...(this.licenseCheckerConfiguration.python.allowedTypes || ["Pipenv"])
    ]
  }

  scan() {
    return this.createScanningEnvironment((context) => {
      const npmProjectsToCheck = this.collectNpmPackageJsons(context);

      const pythonProjectsToCheck = this.collectPythonPackages(context);

      const verifyHashCodes = this.checkHasPackageFileUpdated(context, [
        ...npmProjectsToCheck,
        ...pythonProjectsToCheck,
      ]);

      if (verifyHashCodes) {
        console.log('Licenses are out of sync.');
      }

      if (this.force || (verifyHashCodes && this.fix)) {
        console.log('Licenses are regenerating ...');
        this.runCheckLicenses(context, npmProjectsToCheck, pythonProjectsToCheck);

        this.mergeLicenseFiles(context);

        this.updateVerificationJson();
        console.log('Licenses have been regenerated.');
      } else if (verifyHashCodes) {
        console.log('Licenses check failed.');
        return 1;
      } else {
        console.log('Licenses are up to date.');
      }

      return 0;
    });
  }

  /**
   * Scans the working directory and all subfolder for existing package.json files.
   *
   * @param context scanning environment context
   * @returns
   */
  private collectNpmPackageJsons(context: ScanningContext) {
    const packageJsons = glob.sync('**/package.json', {
      cwd: context.projectRoot,
      ignore: this.licenseCheckerConfiguration.excludeFolders,
      absolute: true,
    });

    return packageJsons.filter(
      (jsonPath) =>
        !this.licenseCheckerConfiguration.npm.excludedSubProjects.find((exclude) => jsonPath.endsWith(exclude)),
    );
  }

  /**
   * Scans the working directory and all subfolder for existing Pipfile of requirements.txt
   *
   * @param context scanning environment context
   * @returns
   */
  private collectPythonPackages(context: ScanningContext) {
    const lookup = this.licenseCheckerConfiguration.python.allowedTypes.map((pkgType) => { switch(pkgType) {
      case "Pipenv": return '**/Pipfile';
      case "requirements.txt": return '**/requirements.txt';
      default: throw new Error(`Unsupported type ${pkgType}.`)
    }});

    const pythonPackages = glob.sync(lookup, {
      cwd: context.projectRoot,
      ignore: this.licenseCheckerConfiguration.excludeFolders,
      absolute: true,
    });

    return pythonPackages.filter(
      (jsonPath) =>
        !this.licenseCheckerConfiguration.python.excludedSubProjects.find((exclude) => jsonPath.endsWith(exclude)),
    );
  }

  /**
   * Checks is there any project file (package.json or Pipfile or requirements.txt) which has been modified.
   * The state is maintained in the package-verification.json file.
   *
   * @param context scanning environment context
   * @param projectFiles list of package.json or Pipfile or requirements.txt
   * @returns
   */
  private checkHasPackageFileUpdated(context: ScanningContext, projectFiles: string[]) {
    if (!existsSync(VERIFICATION_FILE)) {
      this.verificationJson = {};
    } else {
      this.verificationJson = JSON.parse(readFileSync(VERIFICATION_FILE, { encoding: 'utf8' }));
    }

    this.licenseSection = this.verificationJson.license || {};

    let result = false;

    let projectFilesList = '';
    projectFiles.forEach((projectFile) => {
      const projectRelativePath = path.relative(context.projectRoot, projectFile);
      const verifiedHashCode = this.licenseSection[projectRelativePath];

      const currentHashCode = CliHelpers.generateChecksum(projectFile);

      this.newLicensesSection[projectRelativePath] = currentHashCode;
      if (verifiedHashCode !== currentHashCode) {
        console.log(`File ${projectFile} has changed since last scan.`);
        result = true;
      }

      projectFilesList += projectRelativePath;
    });

    const currentHashCodeOfProjectFiles = CliHelpers.generateChecksumForText(projectFilesList);

    const verifiedHashCode = this.licenseSection[LICENSE_FILES_SUMMARY_HASH];

    this.newLicensesSection[LICENSE_FILES_SUMMARY_HASH] = currentHashCodeOfProjectFiles;
    if (verifiedHashCode !== currentHashCodeOfProjectFiles) {
      console.log('Source of licenses has changed since last scan.');
      result = true;
    }

    return result;
  }

  private updateVerificationJson() {
    this.verificationJson.license = this.newLicensesSection;
    writeFileSync(VERIFICATION_FILE, JSON.stringify(this.verificationJson, null, 2), { encoding: 'utf-8' });
  }

  /**
   * Orchestrates the license checking of the projects
   *
   * @param context scanning environment context
   * @param npmProjectsToCheck list of NPM projects to verify
   * @param pythonProjectsToCheck list of Python projects to verify
   */
  private runCheckLicenses(context: ScanningContext, npmProjectsToCheck: string[], pythonProjectsToCheck: string[]) {
    console.log('Scanning NPM packages...');

    npmProjectsToCheck.forEach((npmProjectToCheck) => this.runNPMLicenseCheck(context, npmProjectToCheck));

    if (pythonProjectsToCheck.length > 0) {
      console.log('Scanning Python packages...');
      this.installPythonLibsForLicenseCheck(context);
      pythonProjectsToCheck.forEach((pythonProjectToCheck) =>
        this.runPythonLicenseCheck(context, pythonProjectToCheck),
      );
    }
  }

  /**
   * Installs the NPM dependencies as that is required to be locally present for the license chacker tool
   *
   * @param projectWorkingDirectory working directory of the folder
   */
  private runNPMCI(projectWorkingDirectory: string) {
    console.log(`Running NPM CI in folder ${projectWorkingDirectory}`);
    const commandArgs = ['ci'];

    const command = 'npm';

    const options: SpawnSyncOptions = {
      encoding: 'utf8',
      stdio: 'inherit',
      timeout: 5 * 60 * 1000,
      cwd: projectWorkingDirectory,
    };

    // Suppressed as no user input it used to manage the path and child_process
    // nosemgrep
    const commandResults = spawnSync(command, commandArgs, options);

    if (commandResults.status !== 0) {
      console.error('Failed to run NPM CI.');
      throw new Error('Failed to run NPM CI.');
    }
  }

  /**
   * Collect the licenses of the NPM dependencies of the project.
   * When the NPM project doesn't have an package-lock.json or npm-shrinkwrap.json file then it is assumed that all of it is dependencies are listed in a higher level of package.json.
   *
   * @param context scanning environment context
   * @param npmProjectToCheck NPM project to check
   * @returns
   */
  private runNPMLicenseCheck(context: ScanningContext, npmProjectToCheck: string) {
    const projectRelativePath = path.relative(context.projectRoot, npmProjectToCheck);
    const projectFolder = path.dirname(projectRelativePath);
    const noticeSuffix = projectRelativePath.replace(/\//g, '-');
    // Suppressed as no user input it used to manage the path and child_process
    // nosemgrep
    const tmpNoticeLocation = path.join(context.workingDir, `NOTICE.npm.${noticeSuffix}`);
    // Suppressed as no user input it used to manage the path and child_process
    // nosemgrep
    const tmpNoticeSummaryLocation = path.join(context.workingDir, `OSS_License_Summary.npm.${noticeSuffix}.csv`);

    console.log(`Checking licenses in ${npmProjectToCheck}`);
    if (
      // Suppressed as no user input it used to manage the path and child_process
      // nosemgrep
      existsSync(path.join(context.projectRoot, projectFolder, 'package-lock.json')) ||
      // Suppressed as no user input it used to manage the path and child_process
      // nosemgrep
      existsSync(path.join(context.projectRoot, projectFolder, 'npm-shrinkwrap.json'))
    ) {
      // Suppressed as no user input it used to manage the path and child_process
      // nosemgrep
      this.runNPMCI(path.join(context.projectRoot, projectFolder));
    } else {
      console.log(
        `NPM project ${npmProjectToCheck} doesn't have a lock file (package-lock.json or npm-shrinkwrap.json).`,
      );
      console.log("It is assumed that their dependencies as part of another project's dependency list.");
      console.log('If this is not the case, please create the lock file with executing npm install.');

      return;
    }

    this.checkedNPMBannedLicenses(context, projectRelativePath, projectFolder);
    this.generateNPMNotice(context, projectRelativePath, projectFolder, tmpNoticeLocation);
    this.generateNPMSummary(context, projectRelativePath, projectFolder, tmpNoticeSummaryLocation);
  }

  /**
   * Generates the summary of the various license types used in the NPM project
   *
   * @param context scanning environment context
   * @param npmProjectFile NPM project file relative location
   * @param npmPackageFolder NPM project folder
   * @param tmpNoticeSummaryLocation temporary location of the summary file
   */
  private generateNPMSummary(
    context: ScanningContext,
    npmProjectFile: string,
    npmPackageFolder: string,
    tmpNoticeSummaryLocation: string,
  ) {
    const commandArgs = ['-y', NPM_LICENSE_CHECKER_TOOL, '--summary', '--csv', '--start', npmPackageFolder];

    if (this.licenseCheckerConfiguration.npm.excluded && this.licenseCheckerConfiguration.npm.excluded.length != 0) {
      const excludedPackages = this.licenseCheckerConfiguration.npm.excluded.join(';');
      commandArgs.push('--excludePackages', excludedPackages);
    }

    const options: SpawnSyncOptions = {
      encoding: 'utf8',
      stdio: ['ignore', openSync(tmpNoticeSummaryLocation, 'a'), 'inherit'],
      ...GLOBAL_TIMEOUT,
    };
    // Suppressed as no user input it used to manage the path and child_process
    // nosemgrep
    const commandResults = spawnSync('npx', commandArgs, options);

    if (commandResults.status !== 0) {
      console.error(`Module ${npmProjectFile} failed the license check.`);
      throw new Error(`Module ${npmProjectFile} failed the license check.`);
    }

    const csvValues = parse(readFileSync(tmpNoticeSummaryLocation, { encoding: 'utf8' }), {
      delimiter: ',',
      columns: true,
    });

    const licenseSummary: Record<string, number> = {};

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    csvValues.forEach((rows: { [x: string]: any }) => {
      const license = rows.license;
      if (license) {
        const count = licenseSummary[license] || 0;
        licenseSummary[license] = count + 1;
      }
    });

    let output = '#########################\n';
    output += `# NPM module: ${npmProjectFile}\n`;
    output += '#########################\n';
    output += stringify(
      Object.entries(licenseSummary)
        .sort()
        .map(([license, count]) => ({ License: license, Count: count })),
      { header: true, quoted: true },
    );
    writeFileSync(tmpNoticeSummaryLocation, output);
  }

  /**
   * Generates the temporary NOTICE file based on the dependencies used in the NPM project
   *
   * @param context scanning environment context
   * @param npmProjectFile NPM project file relative location
   * @param npmPackageFolder NPM project folder
   * @param tmpNoticeLocation temporary location of the NOTICE file
   */
  private generateNPMNotice(
    context: ScanningContext,
    npmProjectFile: string,
    npmPackageFolder: string,
    tmpNoticeLocation: string,
  ) {
    const commandArgs = ['-y', NPM_LICENSE_CHECKER_TOOL, '--plainVertical'];

    if (this.licenseCheckerConfiguration.npm.excluded && this.licenseCheckerConfiguration.npm.excluded.length != 0) {
      const excludedPackages = this.licenseCheckerConfiguration.npm.excluded.join(';');
      commandArgs.push('--excludePackages', excludedPackages);
    }

    const options: SpawnSyncOptions = {
      cwd: npmPackageFolder,
      encoding: 'utf8',
      stdio: ['ignore', openSync(tmpNoticeLocation, 'w+'), 'inherit'],
      ...GLOBAL_TIMEOUT,
    };
    // Suppressed as no user input it used to manage the path and child_process
    // nosemgrep
    const commandResults = spawnSync('npx', commandArgs, options);

    if (commandResults.status !== 0) {
      console.error(`Module ${npmProjectFile} failed the license check.`);
      throw new Error(`Module ${npmProjectFile} failed the license check.`);
    }
  }

  /**
   * Verifies there are no banned Licenses across the dependencies used.
   *
   * @param context scanning environment context
   * @param npmProjectFile NPM project file relative location
   * @param projectFolder NPM project file relative location
   */
  private checkedNPMBannedLicenses(context: ScanningContext, npmProjectFile: string, projectFolder: string) {
    const commandArgs = [
      '-y',
      NPM_LICENSE_CHECKER_TOOL,
      '--failOn',
      this.licenseCheckerConfiguration.failOnLicenses.join(';'),
    ];

    if (this.licenseCheckerConfiguration.npm.excluded && this.licenseCheckerConfiguration.npm.excluded.length != 0) {
      const excludedPackages = this.licenseCheckerConfiguration.npm.excluded.join(';');
      commandArgs.push('--excludePackages', excludedPackages);
    }

    const options: SpawnSyncOptions = {
      cwd: projectFolder,
      encoding: 'utf8',
      stdio: ['ignore', 'ignore', 'inherit'],
      ...GLOBAL_TIMEOUT,
    };
    // Suppressed as no user input it used to manage the path and child_process
    // nosemgrep
    const commandResults = spawnSync('npx', commandArgs, options);

    if (commandResults.status !== 0) {
      console.error(`Project ${npmProjectFile} failed the license check. It contains dependency with banned license.`);
      throw new Error(
        `Project ${npmProjectFile} failed the license check. It contains dependency with banned license.`,
      );
    }
  }

  /**
   * Installs the python dependencies used to do the license checking into the venv
   *
   * @param context scanning environment context
   */
  private installPythonLibsForLicenseCheck(context: ScanningContext) {
    const pipExecutable = context.pip;
    // Suppressed as no user input it used to manage the path and child_process
    // nosemgrep
    const pipUpgrade = spawnSync(pipExecutable, ['install', '--upgrade', 'pip'], {
      stdio: 'ignore',
      encoding: 'utf8',
      ...GLOBAL_TIMEOUT,
    });

    if (pipUpgrade.status !== 0) {
      throw new Error(`Failed to upgrade pip because ${pipUpgrade.stderr}`);
    }
    // Suppressed as no user input it used to manage the path and child_process
    // nosemgrep
    const pipInstall = spawnSync(pipExecutable, ['install', PYTHON_LICENSE_CHECKER_TOOL, 'pipenv'], {
      encoding: 'utf8',
      ...GLOBAL_TIMEOUT,
    });

    if (pipInstall.status !== 0) {
      throw new Error(`Failed to install ${PYTHON_LICENSE_CHECKER_TOOL} and pipenv because ${pipInstall.stderr}`);
    }
  }

  /**
   * Collect the licenses of the Python project
   *
   * @param context scanning environment context
   * @param pythonProjectToCheck Python project to check
   */
  private runPythonLicenseCheck(context: ScanningContext, pythonProjectToCheck: string) {
    const projectRelativePath = path.relative(context.projectRoot, pythonProjectToCheck);
    const noticeSuffix = projectRelativePath.replace(/\//g, '-');
    // Suppressed as no user input it used to manage the path and child_process
    // nosemgrep
    const tmpNoticeLocation = path.join(context.workingDir, `NOTICE.python.${noticeSuffix}`);
    // Suppressed as no user input it used to manage the path and child_process
    // nosemgrep
    const tmpNoticeSummaryLocation = path.join(context.workingDir, `OSS_License_Summary.python.${noticeSuffix}.csv`);

    console.log(`Checking licenses in ${pythonProjectToCheck}`);
    process.env.PIPENV_IGNORE_VIRTUALENVS = '1';
    const venvLocation = this.installPythonDependencies(context, projectRelativePath, noticeSuffix);
    this.checkedPythonBannedLicenses(context, projectRelativePath, venvLocation);
    this.generatePythonNotice(context, projectRelativePath, venvLocation, tmpNoticeLocation);
    this.generatePythonSummary(context, projectRelativePath, venvLocation, tmpNoticeSummaryLocation);
  }

  /**
   * Install the dependencies for the Python project`
   *
   * @param context scanning environment context
   * @param pythonProjectToCheck Python project to check
   * @param noticeSuffix suffix to be used to create venv if not pipenv is used
   * @returns
   */
  private installPythonDependencies(context: ScanningContext, pythonProjectToCheck: string, noticeSuffix: string) {
    if (pythonProjectToCheck.endsWith('Pipfile')) {
      // Suppressed as no user input it used to manage the path and child_process
      // nosemgrep
      const pipenvSync = spawnSync(path.join(context.workingDir, '.venv', 'bin', 'pipenv'), ['sync'], {
        cwd: path.dirname(pythonProjectToCheck),
      });

      if (pipenvSync.status !== 0) {
        throw new Error(`Failed to synchronize pipenv ${pythonProjectToCheck}`);
      }
      // Suppressed as no user input it used to manage the path and child_process
      // nosemgrep
      const pipenvSyncVenvLocation = spawnSync(path.join(context.workingDir, '.venv', 'bin', 'pipenv'), ['--venv'], {
        cwd: path.dirname(pythonProjectToCheck),
        stdio: 'pipe',
        encoding: 'utf8',
      });

      if (pipenvSyncVenvLocation.status !== 0) {
        throw new Error(`Failed to retrieve pipenv venv location for ${pythonProjectToCheck}`);
      }

      return pipenvSyncVenvLocation.stdout.trim();
    } else if (pythonProjectToCheck.endsWith('requirements.txt')) {
      const venvFolder = '.venv-' + noticeSuffix;
      // Suppressed as no user input it used to manage the path and child_process
      // nosemgrep
      const venvLocation = path.join(context.workingDir, venvFolder);

      const pythonCommand = context.python;
      // Suppressed as no user input it used to manage the path and child_process
      // nosemgrep
      const vEnvCreation = spawnSync(pythonCommand, ['-m', 'venv', venvLocation]);

      if (vEnvCreation.status !== 0) {
        throw new Error(`Failed to create virtual environment ${venvLocation}`);
      }
      // Suppressed as no user input it used to manage the path and child_process
      // nosemgrep
      const pipInstall = spawnSync(path.join(venvLocation, 'bin', 'pip'), ['install', '-r', pythonProjectToCheck], {
        cwd: context.projectRoot,
        stdio: 'inherit',
        encoding: 'utf8',
        ...GLOBAL_TIMEOUT,
      });

      if (pipInstall.status !== 0) {
        throw new Error(`Failed to install dependencies listed in ${pythonProjectToCheck}`);
      }

      return venvLocation;
    } else {
      throw new Error(`Python package ${pythonProjectToCheck} is not a Pipfile or requirements.txt file.`);
    }
  }

  /**
   * Verifies there are no banned Licenses across the dependencies used.
   *
   * @param context scanning environment context
   * @param pythonProjectToCheck Python project file relative location
   * @param venvLocation location of the virtual environment
   */
  private checkedPythonBannedLicenses(context: ScanningContext, pythonProjectToCheck: string, venvLocation: string) {
    const commandArgs = [
      // Suppressed as no user input it used to manage the path and child_process
      // nosemgrep
      `--python=${path.join(venvLocation, 'bin', 'python')}`,
      `--fail-on=${this.licenseCheckerConfiguration.failOnLicenses.join(';')}`,
    ];

    this.addPythonPackageExclusion(commandArgs);

    const options: SpawnSyncOptions = {
      encoding: 'utf8',
      stdio: 'inherit',
      ...GLOBAL_TIMEOUT,
    };
    const commandResults = spawnSync(
      // Suppressed as no user input it used to manage the path and child_process
      // nosemgrep
      path.join(context.workingDir, '.venv', 'bin', PYTHON_LICENSE_CHECKER_TOOL),
      commandArgs,
      options,
    );

    if (commandResults.status !== 0) {
      console.error(
        `Module ${pythonProjectToCheck} failed the license check. It contains dependency with banned license.`,
      );
      throw new Error(
        `Module ${pythonProjectToCheck} failed the license check. It contains dependency with banned license.`,
      );
    }
  }

  /**
   * Extends the base list of command line arguments to exclude packages from the license check
   *
   * @param commandArgs base list of command line arguments
   */
  private addPythonPackageExclusion(commandArgs: string[]) {
    if (
      this.licenseCheckerConfiguration.python.excluded &&
      this.licenseCheckerConfiguration.python.excluded.length != 0
    ) {
      commandArgs.push('--ignore-packages', ...this.licenseCheckerConfiguration.python.excluded);
    }
  }

  /**
   * Generates the summary of the various license types used in the Python project
   *
   * @param context scanning environment context
   * @param pythonProjectToCheck Python project file relative location
   * @param venvLocation location of the virtual environment
   * @param tmpNoticeSummaryLocation temporary location of the summary file
   */
  private generatePythonSummary(
    context: ScanningContext,
    pythonProjectToCheck: string,
    venvLocation: string,
    tmpNoticeSummaryLocation: string,
  ) {
    const commandArgs = [
      // Suppressed as no user input it used to manage the path and child_process
      // nosemgrep
      `--python=${path.join(venvLocation, 'bin', 'python')}`,
      '--summary',
      '-f',
      'csv',
    ];

    this.addPythonPackageExclusion(commandArgs);

    const options: SpawnSyncOptions = {
      encoding: 'utf8',
      stdio: ['ignore', openSync(tmpNoticeSummaryLocation, 'w'), 0],
      ...GLOBAL_TIMEOUT,
    };

    const commandResults = spawnSync(
      // Suppressed as no user input it used to manage the path and child_process
      // nosemgrep
      path.join(context.workingDir, '.venv', 'bin', PYTHON_LICENSE_CHECKER_TOOL),
      commandArgs,
      options,
    );

    if (commandResults.status !== 0) {
      console.error(`Module ${pythonProjectToCheck} failed the license check.`);
      throw new Error(`Module ${pythonProjectToCheck} failed the license check.`);
    }

    const csvValues = parse(readFileSync(tmpNoticeSummaryLocation, { encoding: 'utf8' }), {
      delimiter: ',',
      columns: true,
      quote: true,
    });

    let output = '#########################\n';
    output += `# Python module: ${pythonProjectToCheck}\n`;
    output += '#########################\n';
    output += stringify(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      Object.entries(csvValues).map((row: any) => ({
        License: row[1].License,
        Count: row[1].Count,
      })),
      { header: true, quoted: true },
    );
    writeFileSync(tmpNoticeSummaryLocation, output);
  }

  /**
   * Generates the temporary NOTICE file based on the dependencies used in the Python project
   *
   * @param context scanning environment context
   * @param pythonProjectToCheck Python project file relative location
   * @param venvLocation location of the virtual environment
   * @param tmpNoticeLocation temporary location of the NOTICE file
   */
  private generatePythonNotice(
    context: ScanningContext,
    pythonProjectToCheck: string,
    venvLocation: string,
    tmpNoticeLocation: string,
  ) {
    const commandArgs = [
      // Suppressed as no user input it used to manage the path and child_process
      // nosemgrep
      `--python=${path.join(venvLocation, 'bin', 'python')}`,
      '--format=plain-vertical',
      '--with-license-file',
      '--no-license-path',
    ];

    this.addPythonPackageExclusion(commandArgs);

    const options: SpawnSyncOptions = {
      encoding: 'utf8',
      stdio: ['ignore', openSync(tmpNoticeLocation, 'w'), 0],
      ...GLOBAL_TIMEOUT,
    };

    const commandResults = spawnSync(
      // Suppressed as no user input it used to manage the path and child_process
      // nosemgrep
      path.join(context.workingDir, '.venv', 'bin', PYTHON_LICENSE_CHECKER_TOOL),
      commandArgs,
      options,
    );

    if (commandResults.status !== 0) {
      console.error(`Module ${pythonProjectToCheck} failed the license check.`);
      throw new Error(`Module ${pythonProjectToCheck} failed the license check.`);
    }
  }

  private createScanningEnvironment(scanning: (context: ScanningContext) => number) {
    let workingDir;
    let exitCode = 0;
    try {
      if (this.debug) {
        workingDir = path.join(process.cwd(), 'license-debug');

        if (existsSync(workingDir)) {
          rmSync(workingDir, { recursive: true });
        }

        mkdirSync(workingDir);
      } else {
        workingDir = mkdtempSync(path.join(os.tmpdir(), 'license'));
      }

      const venvLocation = path.join(workingDir, '.venv');

      const pythonCommands = CliHelpers.getPythonCommand();
      // Suppressed as no user input it used to manage the path and child_process
      // nosemgrep
      const vEnvCreation = spawnSync(pythonCommands.pythonExecutable, ['-m', 'venv', venvLocation]);

      if (vEnvCreation.status !== 0) {
        throw new Error(`Failed to create virtual environment ${venvLocation}`);
      }

      exitCode = scanning({
        projectRoot: process.cwd(),
        workingDir: workingDir,
        // Suppressed as no user input it used to manage the path and child_process
        // nosemgrep
        pip: path.join(venvLocation, 'bin', pythonCommands.pipExecutable),
        // Suppressed as no user input it used to manage the path and child_process
        // nosemgrep
        python: path.join(venvLocation, 'bin', pythonCommands.pythonExecutable),
      });
    } catch (error) {
      console.error(error);
      console.error('License scan failed');
      exitCode = 1;
    } finally {
      if (workingDir && !this.debug) {
        rmSync(workingDir, { recursive: true });
      }
    }

    return exitCode;
  }

  /**
   * Merging temporary files together to provide the final files
   *
   * @param context scanning environment context
   */
  private mergeLicenseFiles(context: ScanningContext) {
    // Suppressed as no user input it used to manage the path and child_process
    // nosemgrep
    const licenseFiles = glob.sync(path.join(context.workingDir, 'NOTICE.*'));

    let output = '';

    licenseFiles.sort().forEach((file) => {
      const fileContent = readFileSync(file, { encoding: 'utf8' });
      output += fileContent;
    });

    // Suppressed as no user input it used to manage the path and child_process
    // nosemgrep
    writeFileSync(path.join(context.projectRoot, 'NOTICE'), output);

    // Suppressed as no user input it used to manage the path and child_process
    // nosemgrep
    const licenseSummaryFiles = glob.sync(path.join(context.workingDir, 'OSS_License_Summary.*'));

    let outputSummary = '';

    licenseSummaryFiles.sort().forEach((file) => {
      const fileContent = readFileSync(file, { encoding: 'utf8' });
      outputSummary += fileContent;
    });

    // Suppressed as no user input it used to manage the path and child_process
    // nosemgrep
    writeFileSync(path.join(context.projectRoot, 'OSS_License_Summary.csv'), outputSummary);
  }
}

const args = process.argv.slice(2);

const result = new LicenseChecker(
  './licensecheck.json',
  args.find(arg => arg === '--force') != undefined,
  args.find(arg => arg === '--fix') != undefined,
  args.find(arg => arg === '--debug') != undefined,
).scan();

if (result) {
  console.error('License validation failed.');
  process.exit(result);
}
