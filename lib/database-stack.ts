import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { NagSuppressions } from 'cdk-nag';


export class DatabaseStack extends cdk.Stack {
  public readonly clusterArn:string;
  public readonly clusterIdentifier:string;
  public readonly secretArn:string;
  public readonly databaseName:string;
  public readonly vpc: ec2.Vpc;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // create a new vpc
    this.vpc = new ec2.Vpc(this, 'RDSDatabaseVPC', {
      maxAzs: 2,
      natGateways: 1,
    });
    

    // create an RDS database secret
    const dbSecret = new rds.DatabaseSecret(this, 'SimSearchSecret', {
      username: 'postgres',
    });
    this.secretArn = dbSecret.secretArn;

    this.databaseName = 'postgres';
    const cluster = new rds.DatabaseCluster(this, 'SimSearchCluster', {
      engine: rds.DatabaseClusterEngine.auroraPostgres({ version: rds.AuroraPostgresEngineVersion.VER_15_3 }),
      defaultDatabaseName: this.databaseName,
      storageEncrypted:true,
      iamAuthentication:true,
      deletionProtection:true,
      credentials: rds.Credentials.fromSecret(dbSecret),
      writer: rds.ClusterInstance.serverlessV2('writer', {
        publiclyAccessible: true,
      }),
      readers: [
        rds.ClusterInstance.serverlessV2('reader')
      ],
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS }, // this parameter is optional for serverless Clusters
      vpc:this.vpc, // this parameter is optional for serverless Clusters
      enableDataApi:true
    });
    this.clusterArn = cluster.clusterArn;
    this.clusterIdentifier = cluster.clusterIdentifier;

    // output the cluster arn and secret arn
    new cdk.CfnOutput(this, 'ClusterArn', { value: this.clusterArn });
    new cdk.CfnOutput(this, 'ClusterId', { value: this.clusterIdentifier,  exportName: "RDSStack-ClusterId" });
    new cdk.CfnOutput(this, 'SecretArn', { value: this.secretArn, exportName: "RDSStack-SecretArn" });
    new cdk.CfnOutput(this, 'DatabaseName', { value: this.databaseName });

    NagSuppressions.addStackSuppressions(this,
      [
        { 
          id: 'AwsSolutions-RDS6', 
          reason: 'Data API calls are used from AppSync into a private subnet' 
        },
        {
          id: 'AwsSolutions-VPC7', 
          reason: 'Flow log not enabled to avoid un-necessary costs', 
        },
        {
          id: 'AwsSolutions-SMG4', 
          reason: 'Rotation not enabled', 
        },
      ]
    );
  }
}
