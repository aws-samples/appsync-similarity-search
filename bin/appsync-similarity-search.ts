// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { DatabaseStack } from '../lib/database-stack';
import { ImportDataStack } from '../lib/import-data-stack';
import { AppsyncStack } from '../lib/appsync-middleware-stack';

const app = new cdk.App();
const rdsStack = new DatabaseStack(app, 'RDSStack', {
});

const importDataStack = new ImportDataStack(app, 'ImportDataStack', {
  clusterArn: rdsStack.clusterArn,
  secretArn: rdsStack.secretArn,
  databaseName: rdsStack.databaseName,
  vpc: rdsStack.vpc
});

// create the appsync stack
new AppsyncStack(app, 'AppsyncStack', {
  clusterArn:rdsStack.clusterArn,
  clusterIdentifier:rdsStack.clusterIdentifier,
  secretArn: rdsStack.secretArn,
  databaseName: rdsStack.databaseName,
});
