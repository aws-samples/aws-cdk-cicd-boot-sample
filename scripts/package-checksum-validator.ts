// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

/* eslint-disable no-console */

import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import * as expectedHashes from '../package-verification.json';

const validateChecksum = (filePath: string, expectedHash: string) => {
  const checksum = createHash('sha256');

  const stream = readFileSync(filePath);
  const copyBuffer = new Int32Array(stream, 0, stream.length);
  const newBuffer = Buffer.from(copyBuffer.filter((element, index, typedArray) => {
    if (0x0d === element) {
      if (0x0a === typedArray[index + 1]) { //Windows -> Unix
        return false;
      } else {
        typedArray[index] = 0x0a; //Mac OS -> Unix
      }
    }
    return true;
  }));

  checksum.update(newBuffer);
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