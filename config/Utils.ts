// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

export class Environment {
  /*
    helper class to read ENV variables
    */
  static getEnvVar(varName: string, defaultValue?: string): string {
    const val = process.env[varName];
    if (val == undefined ) {
      if (defaultValue != undefined) return defaultValue;
      throw new Error (`Environment variable ${varName} is not defined`);
    }
    return val;
  }
}