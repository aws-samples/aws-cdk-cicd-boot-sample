#!/usr/bin/env node
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { exec } from "child_process";

if (!process.env.CODEBUILD_BUILD_ID && !process.env.GITHUB_ACTIONS) {   
    exec("npx husky install", (err, stdout, stderr) => {
        if (err) {
          console.error();
          console.error("Error:");
          console.error(err);
          console.error();
        }
        console.log(stdout);
        console.error(stderr);
      }); 
}