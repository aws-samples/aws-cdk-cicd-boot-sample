// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { createHash } from 'crypto';
import { existsSync, readFileSync, writeFileSync } from 'fs';

const VERIFICATION_FILE = './package-verification.json';

const generateChecksum = (filePath: string) => {
  const checksum = createHash('sha256');
  checksum.update(readFileSync(filePath));
  const hexCheckSum = checksum.digest('hex');
  /* eslint-disable no-console */
  console.log(hexCheckSum);

  let checkSumState: Record<string, string> = {};
  if (existsSync(VERIFICATION_FILE)) {
    checkSumState = JSON.parse(readFileSync(VERIFICATION_FILE, { encoding: 'utf8' })) as Record<string, string>;
  }

  checkSumState['package-lock.json'] = hexCheckSum;

  writeFileSync(VERIFICATION_FILE, JSON.stringify(checkSumState, null, 2));
};

generateChecksum('./package-lock.json');
