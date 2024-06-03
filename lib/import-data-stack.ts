// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0


import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as path from 'path';
import * as iam from 'aws-cdk-lib/aws-iam';

// create props for the stack
export interface ImportDataStackProps extends cdk.StackProps {
  clusterArn: string;
  secretArn: string;
  databaseName: string;
  vpc: ec2.Vpc
}
// create a new stack for importing data from s3
export class ImportDataStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ImportDataStackProps) {
      super(scope, id, props);

      const csv_name= 'amazon.csv'
      // upload the csv data into s3 asset
      const salesData = new cdk.aws_s3_assets.Asset(this, 'SalesData', {
          path: path.join(__dirname, `../assets/data/${csv_name}`),
      });
  
      

      // create an ECS fargate cluster
      const cluster = new ecs.Cluster(this, 'ImportEmbeddingsDataCluster', {
        vpc: props.vpc
      });

      // create a log group
      const genEmbedlogGroup = new cdk.aws_logs.LogGroup(this, 'GenEmbedLogGroup', {
        removalPolicy: cdk.RemovalPolicy.DESTROY,
        retention: cdk.aws_logs.RetentionDays.ONE_DAY,
        logGroupName: 'GenEmbedLogGroup'
      });

      // add a task definition for the generating Embeddings
      const genEmbedTaskDefinition = new ecs.FargateTaskDefinition(this, 'GenerateEmbeddingsTaskDefinition', {
        memoryLimitMiB: 4096,
        cpu: 2048,
        runtimePlatform:{
            cpuArchitecture: ecs.CpuArchitecture.X86_64,
            operatingSystemFamily: ecs.OperatingSystemFamily.LINUX
        }
      });
      // add a container image to the task definition
      const GenEmbedContainerImage = ecs.ContainerImage.fromAsset(path.join(__dirname, '../assets/generate-embeddings'));
      genEmbedTaskDefinition.addContainer('GenerateEmbeddingsContainer', {
        logging: ecs.LogDriver.awsLogs({
          streamPrefix: 'GenerateEmbeddings',
          logGroup:genEmbedlogGroup 
        }),
        image: GenEmbedContainerImage,
        environment: {
          'INPUT_BUCKET_URL': salesData.s3ObjectUrl,
          'BUCKET_NAME': salesData.s3BucketName,
        },
      });

      salesData.grantRead(genEmbedTaskDefinition.taskRole);
      // grant write permissions to ecs task to the asset bucket
      const assetBucket = cdk.aws_s3.Bucket.fromBucketName(this, "assetBucket", salesData.s3BucketName);
      assetBucket.grantWrite(genEmbedTaskDefinition.taskRole);
      genEmbedTaskDefinition.taskRole.addToPrincipalPolicy(new iam.PolicyStatement({
        actions: ['bedrock:*'],
        resources: ["*"],
      }));
      
      // add task definition for importing data
      
      // create a log group
      const importDatalogGroup = new cdk.aws_logs.LogGroup(this, 'importDatalogGroup', {
        removalPolicy: cdk.RemovalPolicy.DESTROY,
        retention: cdk.aws_logs.RetentionDays.ONE_DAY,
        logGroupName: 'importDatalogGroup'
      });

      const importDataTaskDefinition = new ecs.FargateTaskDefinition(this, 'ImportDataTaskDefinition', {
        memoryLimitMiB: 4096,
        cpu: 2048,
        runtimePlatform:{
            cpuArchitecture: ecs.CpuArchitecture.X86_64,
            operatingSystemFamily: ecs.OperatingSystemFamily.LINUX
        }
      });
      // add a container image to the task definition
      const ImpContainerImage = ecs.ContainerImage.fromAsset(path.join(__dirname, '../assets/import-data'));
      importDataTaskDefinition.addContainer('ImportDataContainer', {
        logging: ecs.LogDriver.awsLogs({
          streamPrefix: 'ImportData',
          logGroup:importDatalogGroup 
        }),
        image: ImpContainerImage,
        environment: {
          'INPUT_BUCKET_URL': salesData.s3ObjectUrl,
          'BUCKET_NAME': salesData.s3BucketName,
          'DATABASE_NAME': props.databaseName,
          'CLUSTER_ARN':props.clusterArn,
          'SECRET_ARN':props.secretArn
        },
      });

      salesData.grantRead(importDataTaskDefinition.taskRole);
      // grant write permissions to ecs task to the asset bucket
      assetBucket.grantWrite(importDataTaskDefinition.taskRole);
      // add a managed RDS data policy to the task
      importDataTaskDefinition.taskRole.addToPrincipalPolicy(new iam.PolicyStatement({
        actions: ['rds:*','rds-data:*'],
        resources: [props.clusterArn],
      }));
      importDataTaskDefinition.taskRole.addToPrincipalPolicy(new iam.PolicyStatement({
        actions: ['secretsmanager:*'],
        resources: [props.secretArn],
      }));
      
    
  }
}
