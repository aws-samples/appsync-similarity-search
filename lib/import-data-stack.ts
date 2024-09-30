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
      const embeddings_csv_name = 'embeddings.csv'
      // create an S3 Asset to store the csv with a specific name
      const salesData = new cdk.aws_s3_assets.Asset(this, 'salesData', {
        path: path.join(__dirname, '../assets/data', csv_name),
      });
      // create the asset bucket
      const assetBucket = cdk.aws_s3.Bucket.fromBucketName(this, "assetBucket", salesData.s3BucketName);
      // output the bucket name and url
      new cdk.CfnOutput(this, 'BucketName', { value: salesData.s3BucketName });
      new cdk.CfnOutput(this, 'ObjectKey', { value: salesData.s3ObjectKey });

      // create a log group for generate embed function
      const genEmbedLambdaLogGroup = new logs.LogGroup(this, 'GenEmbedLambdaLogGroup', {
        logGroupName: '/aws/lambda/generate_embeddings_function',
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      });
      
      // create a lambda iam role for the generate embeddings function
      const genEmbedLambdaIamRole = new iam.Role(this, 'GenEmbedLambdaIamRole', {
        assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      });
      genEmbedLambdaIamRole.addToPolicy(new iam.PolicyStatement({
        actions: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents'],
        resources: [genEmbedLambdaLogGroup.logGroupArn],
      }));
      genEmbedLambdaIamRole.addToPolicy(new iam.PolicyStatement({
        actions: [
          's3:GetObject',
          's3:ListBucket',
          's3:PutObject',
          's3:DeleteObject'
        ],
        resources: [
          assetBucket.bucketArn,
          `${assetBucket.bucketArn}/${csv_name}`,
          `${assetBucket.bucketArn}/${embeddings_csv_name}`,
          `${assetBucket.bucketArn}/${salesData.s3ObjectKey}`,
        ],
      }));
      genEmbedLambdaIamRole.addToPolicy(new iam.PolicyStatement({
        actions: ['bedrock:InvokeModel'],
        resources: [`arn:aws:bedrock:${this.region}::foundation-model/amazon.titan-embed-text-v2:0`],
      }));
      const generateEmbeddingsFunction = new cdk.aws_lambda.DockerImageFunction(this, 'generateEmbeddingsFunction', {
        role: genEmbedLambdaIamRole,
        memorySize: 4096,
        timeout: cdk.Duration.seconds(600),
        code: cdk.aws_lambda.DockerImageCode.fromImageAsset(path.join(__dirname, '../assets/lambda/generate_embeddings')),
        environment: {
          'INPUT_BUCKET_URL': salesData.s3ObjectUrl,
          'BUCKET_NAME': salesData.s3BucketName,
          'EMBEDDINGS_CSV_NAME': embeddings_csv_name,
          'CSV_NAME': csv_name
        },
      });


      // create a log group for import data function
      const importDataLogGroup = new logs.LogGroup(this, 'LambdaLogGroup', {
        logGroupName: '/aws/lambda/import_data_function',
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      });
    
      // create lambda Iam Role for the import function
      const importLambdaIamRole = new iam.Role(this, 'LambdaIamRole', {
        assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      });
      importLambdaIamRole.addToPolicy(new iam.PolicyStatement({
        actions: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents'],
        resources: [importDataLogGroup.logGroupArn],
      }));
      importLambdaIamRole.addToPolicy(new iam.PolicyStatement({
        actions: ['s3:GetObject', 's3:ListBucket'],
        resources: [
          assetBucket.bucketArn, 
          `${assetBucket.bucketArn}/${csv_name}`,
          `${assetBucket.bucketArn}/${embeddings_csv_name}`,
        ],
      }));
      importLambdaIamRole.addToPolicy(new iam.PolicyStatement({
        actions: ['rds-data:ExecuteStatement'],
        resources: [props.clusterArn],
      }));
      importLambdaIamRole.addToPolicy(new iam.PolicyStatement({
        actions: ['secretsmanager:GetSecretValue'],
        resources: [props.secretArn],
      }));

      // create a lambda function with a docker runtime
      const lambdaImportFunction = new cdk.aws_lambda.DockerImageFunction(this, 'ImportDataFunction', {
        role: importLambdaIamRole,
        memorySize: 4096,
        timeout: cdk.Duration.seconds(600),
        code: cdk.aws_lambda.DockerImageCode.fromImageAsset(path.join(__dirname, '../assets/lambda/import_data')),
        environment: {
          'INPUT_BUCKET_URL': salesData.s3ObjectUrl,
          'BUCKET_NAME': salesData.s3BucketName,
          'DATABASE_NAME': props.databaseName,
          'CLUSTER_ARN':props.clusterArn,
          'SECRET_ARN':props.secretArn
        },
      });
      
      
      // const stpFnlogGroup = new logs.LogGroup(this, 'stpFnlogGroup');

      // create a new lambda inoke task for generating embeddings
      const runGenEmbedTask = new tasks.LambdaInvoke(this, 'RunLambdaGen', {
        lambdaFunction: generateEmbeddingsFunction,
      });

      // create a new lambda inoke task for importing data
      const runImportTask = new tasks.LambdaInvoke(this, 'RunLambdaImport', {
        lambdaFunction: lambdaImportFunction,
      });

      // create a state machine role to acess the lambda functions
      const stateMachineRole = new iam.Role(this, 'StateMachineRole', {
        assumedBy: new iam.ServicePrincipal('states.amazonaws.com'),
      });

      const importDataStepFunction = new sfn.StateMachine(this, 'StateMachine', {
        role: stateMachineRole.withoutPolicyUpdates(),
        definitionBody: sfn.DefinitionBody.fromChainable(
          runGenEmbedTask.next(runImportTask)
        ),
      });

      stateMachineRole.addToPolicy(new iam.PolicyStatement({
        actions: ['lambda:InvokeFunction'],
        resources: [generateEmbeddingsFunction.functionArn, lambdaImportFunction.functionArn],
      }));
      
      // output the state function arn
      new cdk.CfnOutput(this, 'StateFunctionArn', { value: importDataStepFunction.stateMachineArn });

      NagSuppressions.addStackSuppressions(this,
        
        [
          { id: 'AwsSolutions-SF1', reason: 'Not logging all Step Function events'},
          { id: 'AwsSolutions-SF2', reason: 'Not enabling X-ray tracing in Step Function'},
          { id: 'AwsSolutions-VPC7', reason: 'Flow log not enabled to avoid un-necessary costs'}
        ]
      );
    
  }
}
