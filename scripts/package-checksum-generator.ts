// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { createHash } from 'crypto';
import { readFileSync, writeFileSync } from 'fs';

const generateChecksum = (filePath: string) => {
  const checksum = createHash('sha256');
  checksum.update(readFileSync(filePath));
  const hexCheckSum = checksum.digest('hex');
  /* eslint-disable no-console */
  console.log(hexCheckSum);
  const checkSumMessage = { 'package-lock.json': hexCheckSum };

  writeFileSync('./package-verification.json', JSON.stringify(checkSumMessage));
};

generateChecksum('./package-lock.json');
