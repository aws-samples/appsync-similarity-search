// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0


import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as appsync from 'aws-cdk-lib/aws-appsync';
import * as path from 'path';
import * as logs from 'aws-cdk-lib/aws-logs';

// create props for the stack
export interface AppSyncStackProps extends cdk.StackProps {
  clusterIdentifier: string;
  clusterArn: string;
  secretArn: string;
  databaseName: string;
}

export class AppsyncStack extends cdk.Stack {
  
  constructor(scope: Construct, id: string, props: AppSyncStackProps) {
    super(scope, id, props);

    const logConfig: appsync.LogConfig = {
      retention: logs.RetentionDays.ONE_WEEK,
    };
    const api = new appsync.GraphqlApi(this, 'Api', {
      name: 'similaritySearch',
      definition: appsync.Definition.fromFile(path.join(__dirname, '../assets/graphql/schema.graphql')),
      authorizationConfig: {
        defaultAuthorization: {
          authorizationType: appsync.AuthorizationType.API_KEY,
        },
      },
      xrayEnabled: true,
      logConfig
    });

    const secret = cdk.aws_secretsmanager.Secret.fromSecretCompleteArn(this, 'Secret', props.secretArn as string)

    // get the RDS cluster from cluster arn
    const cluster = rds.ServerlessCluster.fromServerlessClusterAttributes(this, 'Cluster', {
      clusterIdentifier: props.clusterIdentifier,
      secret:secret
    });

    const rdsDS = api.addRdsDataSource('rds', cluster, secret, 'postgres');
    cluster.grantDataApiAccess(rdsDS);

    rdsDS.createResolver('QueryGetProductResolver', {
      typeName: 'Query',
      fieldName: 'getProductById',
      code:appsync.Code.fromAsset(path.join(__dirname, '../assets/graphql/getProductById.js')),
      runtime:appsync.FunctionRuntime.JS_1_0_0
    });

    const lambdaDSFunction = new cdk.aws_lambda.DockerImageFunction(this, 'LambdaDSFunction', {
      code: cdk.aws_lambda.DockerImageCode.fromImageAsset(path.join(__dirname, '../assets/lambda/query_product')),
      timeout:cdk.Duration.minutes(5),
      memorySize:1024,
      environment:{
        CLUSTER_ARN:props.clusterArn,
        SECRET_ARN:props.secretArn,
        DATABASE_NAME:props.databaseName
      }
    })
    const lambdaDS = api.addLambdaDataSource('lambdaDS',
      lambdaDSFunction 
    ); 
    lambdaDS.createResolver('QueryGetProductsBySimilarity', {
      typeName: 'Query',
      fieldName: 'getProductsBySimilarity',
      code:appsync.Code.fromAsset(path.join(__dirname, '../assets/graphql/getProductsBySimilarity.js')),
      runtime:appsync.FunctionRuntime.JS_1_0_0
    });   
    lambdaDSFunction.addToRolePolicy(new cdk.aws_iam.PolicyStatement({
      actions:['rds-data:*'],
      resources:[props.clusterArn]
    }));
    lambdaDSFunction.addToRolePolicy(new cdk.aws_iam.PolicyStatement({
      actions:['bedrock:*'],
      resources:["*"]
    }));
    lambdaDSFunction.addToRolePolicy(new cdk.aws_iam.PolicyStatement({
      actions: ['secretsmanager:*'],
      resources: [props.secretArn]
    }));

  
  }
}
