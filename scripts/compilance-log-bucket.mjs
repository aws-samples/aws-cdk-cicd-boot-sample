#!/usr/bin/env node
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import * as fs from 'fs';
import { S3 } from '@aws-sdk/client-s3';

if (process.argv.length != 5) {
    console.error('compilance-log-bucket.js requires 3 parameters: profile, account, region');

    process.exit(1);
}

const profile=process.argv[2];
const account=process.argv[3];
const region=process.argv[4];

const bucketName=`compliance-log-${account}-${region}`;

const policyJsonPath = './scripts/compliance-bucket-policy.json';

const policyData = fs.readFileSync(policyJsonPath, { encoding: 'utf-8'});

const policy = JSON.parse(policyData);

policy.Statement.forEach(statement => {
    statement.Resource = `arn:aws:s3:::${bucketName}/*`
});

const policyString = JSON.stringify(policy);

(async function () {

    const s3client = new S3({
        region: region,
        profile: profile
    });

    console.log(`Creating bucket ${bucketName}...`);
    try {
        await s3client.createBucket(
            {
                Bucket: bucketName,
                CreateBucketConfiguration: {
                    LocationConstraint: region
                }
            }
        );

        console.log(`Bucket ${bucketName} has been created.`);

        console.log(`Set bucket policy.`);
        await s3client.putBucketPolicy({
            Bucket: bucketName,
            Policy: policyString
        }, (err, data) => {
            if (err) console.log(err, err.stack);
        });

        console.log(`Disable public access.`);
        await s3client.putPublicAccessBlock({
            Bucket: bucketName,
            PublicAccessBlockConfiguration: {
                BlockPublicAcls: true,
                IgnorePublicAcls: true,
                BlockPublicPolicy: true,
                RestrictPublicBuckets: true
            }
        });
    } catch (err) {
        console.error(err);
    }

})();
