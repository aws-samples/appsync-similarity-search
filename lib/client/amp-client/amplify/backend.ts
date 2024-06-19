import { defineBackend } from '@aws-amplify/backend';
import { data } from './data/resource';
import * as rds from 'aws-cdk-lib/aws-rds';
import { Stack, Fn } from 'aws-cdk-lib';
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Code, FunctionRuntime } from 'aws-cdk-lib/aws-appsync';


const backend = defineBackend({
  data,
});

const dataStack = Stack.of(backend.data);

const secret = rds.DatabaseSecret.fromSecretCompleteArn(dataStack, 'secret', Fn.importValue('RDSStack-SecretArn'));
const cluster = rds.ServerlessCluster.fromServerlessClusterAttributes(dataStack, 'cluster', { clusterIdentifier: Fn.importValue('RDSStack-ClusterId'), secret });
const rdsDs = backend.data.addRdsDataSource('rds', cluster, secret, 'postgres', { name: 'productInfo' })
cluster.grantDataApiAccess(rdsDs);

// set up bedrock
const EMBED_MODEL_ID = 'amazon.titan-embed-text-v2:0'
const bedrockDataSource = backend.data.addHttpDataSource('BedrockDataSource', `https://bedrock-runtime.${dataStack.region}.amazonaws.com`, {
  authorizationConfig: { signingRegion: dataStack.region, signingServiceName: 'bedrock' },
});


bedrockDataSource.grantPrincipal.addToPrincipalPolicy(
  new PolicyStatement({
    effect: Effect.ALLOW,
    actions: ['bedrock:InvokeModel'],
    resources: [`arn:aws:bedrock:${dataStack.region}::foundation-model/${EMBED_MODEL_ID}`],
  }),
);

backend.data.resources.cfnResources.cfnGraphqlApi.environmentVariables = { EMBED_MODEL_ID };
backend.data.addResolver('search', {
  typeName: 'Query',
  fieldName: 'search',
  runtime: FunctionRuntime.JS_1_0_0,
  code: Code.fromInline(/*javascript*/ `
    export const request = (ctx) => {}
    export const response = (ctx) => ctx.prev.result
  `),
  pipelineConfig: [
    backend.data.addFunction('embedding', {
      name: 'embeddingFn',
      dataSource: bedrockDataSource,
      code: Code.fromAsset('amplify/data/getEmbedding.js'),
      runtime: FunctionRuntime.JS_1_0_0,
    }),
    backend.data.addFunction('search', {
      name: 'searchFn',
      dataSource: rdsDs,
      code: Code.fromAsset('amplify/data/search.js'),
      runtime: FunctionRuntime.JS_1_0_0,
    }),
  ],
});


