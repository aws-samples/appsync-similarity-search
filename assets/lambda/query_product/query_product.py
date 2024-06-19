import boto3
import os
from langchain_community.embeddings import BedrockEmbeddings 
from langchain_community.llms import Bedrock

def handler(event, context):
    #connect to embeddings model using bedrock-runtime
    bedrock_client = boto3.client(service_name="bedrock-runtime");
    bedrock_embeddings = BedrockEmbeddings(model_id="amazon.titan-embed-text-v1", client=bedrock_client)
    data_client = boto3.client('rds-data')
    # get the query argument
    query = event['arguments']['query']

    # convert the query to an embedding
    query_embedding = bedrock_embeddings.embed_query(query)

    print("Embedding ", query_embedding);

    # connect to the rds clustee
    cluster_arn = os.environ.get('CLUSTER_ARN')
    db_name = os.environ.get('DATABASE_NAME')
    secret_arn = os.environ.get('SECRET_ARN')

    # query the table
    table_name = "product_info"
    sql_statement = f"SELECT product_id, product_name, category, discounted_price, actual_price, discount_percentage, rating, rating_count, about_product FROM {table_name} ORDER BY embedding <-> '{query_embedding}'::vector LIMIT 5"
    result = data_client.execute_statement(
        resourceArn=cluster_arn,
        secretArn=secret_arn,
        database=db_name,
        sql=sql_statement,
        formatRecordsAs="JSON"
    )

    print("Result ", result);
    records = result['formattedRecords']
    return records;


