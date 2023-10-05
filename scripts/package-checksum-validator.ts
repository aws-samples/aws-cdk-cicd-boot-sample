// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

/* eslint-disable no-console */

import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import * as expectedHashes from '../package-verification.json';

const validateChecksum = (filePath: string, expectedHash: string) => {
  const checksum = createHash('sha256');
  checksum.update(readFileSync(filePath));
  const hexCheckSum = checksum.digest('hex');
  if (hexCheckSum !== expectedHash) {
    console.log(`File at ${filePath} has checksum ${hexCheckSum}, which does not match expected value ${expectedHash}`);
    console.log('This likely means dependencies have updated. You must get the changes approved before proceeding');
    console.log('Once you get approval, update ./package-verification.json with the new hash to proceed');
    throw 'Checksums do not match';
  }
  return true;
};
validateChecksum('./package-lock.json', expectedHashes['package-lock.json']);