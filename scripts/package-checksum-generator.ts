// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { createHash } from 'crypto';
import { readFileSync, writeFileSync } from 'fs';

const generateChecksum = (filePath: string) => {
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
  /* eslint-disable no-console */
  console.log(hexCheckSum);
  const checkSumMessage = { 'package-lock.json': hexCheckSum };

  writeFileSync('./package-verification.json', JSON.stringify(checkSumMessage));
};

generateChecksum('./package-lock.json');
