import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as path from 'path';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as tasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as logs from 'aws-cdk-lib/aws-logs';
import { NagSuppressions } from 'cdk-nag';

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
      // create an S3 Asset to store the csv
      const salesData = new cdk.aws_s3_assets.Asset(this, 'salesData', {
        path: path.join(__dirname, '../assets/data', csv_name),
      });
      // output the bucket name and url
      new cdk.CfnOutput(this, 'BucketName', { value: salesData.s3BucketName });
      new cdk.CfnOutput(this, 'ObjectKey', { value: salesData.s3ObjectKey });
      
      // create an ECS fargate cluster
      const cluster = new ecs.Cluster(this, 'ImportEmbeddingsDataCluster', {
        vpc: props.vpc,
        containerInsights:true
      });

      // create a log group
      const genEmbedlogGroup = new cdk.aws_logs.LogGroup(this, 'GenEmbedLogGroup', {
        removalPolicy: cdk.RemovalPolicy.DESTROY,
        retention: cdk.aws_logs.RetentionDays.ONE_DAY,
        logGroupName: 'GenEmbedLogGroup'
      });

      // create a task definition for reading data from s3 and generating Embeddings
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

      // grant write permissions to ecs task to the asset bucket
      const assetBucket = cdk.aws_s3.Bucket.fromBucketName(this, "assetBucket", salesData.s3BucketName);
      // grant read and write permissions to ecs task to the asset bucket
      genEmbedTaskDefinition.taskRole.addToPrincipalPolicy(new iam.PolicyStatement({
        actions: [
          's3:GetObject',
          's3:ListBucket',
          's3:PutObject',
          's3:DeleteObject'
        ],
        effect: iam.Effect.ALLOW,
        resources: [
          assetBucket.bucketArn,
          `${assetBucket.bucketArn}/*`
        ]
      }));
      
      genEmbedTaskDefinition.taskRole.addToPrincipalPolicy(new iam.PolicyStatement({
        actions: ['bedrock:InvokeModel'],
        resources: [`arn:aws:bedrock:${this.region}::foundation-model/amazon.titan-embed-text-v2:0`],
      }));
      
      // create a log group
      const importDatalogGroup = new cdk.aws_logs.LogGroup(this, 'importDatalogGroup', {
        removalPolicy: cdk.RemovalPolicy.DESTROY,
        retention: cdk.aws_logs.RetentionDays.ONE_DAY,
        logGroupName: 'importDatalogGroup'
      });

      // create a task definition for importing data from s3 into the database
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

      
      // grant read and write permissions to ecs task to the asset bucket
      importDataTaskDefinition.taskRole.addToPrincipalPolicy(new iam.PolicyStatement({
        actions: [
          's3:GetObject',
          's3:ListBucket',
        ],
        effect: iam.Effect.ALLOW,
        resources: [
          assetBucket.bucketArn,
          `${assetBucket.bucketArn}/*`
        ]
      }));
      
      importDataTaskDefinition.taskRole.addToPrincipalPolicy(new iam.PolicyStatement({
        actions: ['rds-data:ExecuteStatement'],
        resources: [props.clusterArn],
      }));
      importDataTaskDefinition.taskRole.addToPrincipalPolicy(new iam.PolicyStatement({
        actions: ['secretsmanager:GetSecretValue','secretsmanager:ListSecrets'],
        resources: [props.secretArn],
      }));

      const runGenEmbedTask = new tasks.EcsRunTask(this, 'RunFargateGen', {
        integrationPattern: sfn.IntegrationPattern.RUN_JOB,
        cluster,
        taskDefinition:genEmbedTaskDefinition,
        launchTarget: new tasks.EcsFargateLaunchTarget(),
        propagatedTagSource: ecs.PropagatedTagSource.TASK_DEFINITION,
      });

      // create an ecs task for importData
      const runImportDataTask = new tasks.EcsRunTask(this, 'RunFargateImportData', {
        integrationPattern: sfn.IntegrationPattern.RUN_JOB,
        cluster,
        taskDefinition:importDataTaskDefinition,
        launchTarget: new tasks.EcsFargateLaunchTarget(),
        propagatedTagSource: ecs.PropagatedTagSource.TASK_DEFINITION,
      });

      const stpFnlogGroup = new logs.LogGroup(this, 'stpFnlogGroup');

      const importDataFunction = new sfn.StateMachine(this, 'StateMachine', {
        definitionBody: sfn.DefinitionBody.fromChainable(
          runGenEmbedTask
            .next(runImportDataTask)
        ),
        tracingEnabled:true,
        logs: {
          destination: stpFnlogGroup,
          level: sfn.LogLevel.ALL,
        },
      });
      
      // output the state function arn
      new cdk.CfnOutput(this, 'StateFunctionArn', { value: importDataFunction.stateMachineArn });

      NagSuppressions.addStackSuppressions(this,
        
        [
          { id: 'AwsSolutions-ECS2', reason: 'S3 bucket name and url passed are dynamic and caoonot be stored in key stores' },
          { id: 'AwsSolutions-IAM5', reason: 'CDK used AWS Managed policies which have *'},
          { id: 'AwsSolutions-VPC7', reason: 'Flow log not enabled to avoid un-necessary costs'}
        ]
      );
    
  }
}
