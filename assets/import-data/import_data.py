# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0


import boto3
import os
import awswrangler as wr
import awswrangler.pandas as pd
from awswrangler import _data_types, _databases, _utils, exceptions
from awswrangler._sql_utils import identifier
from awswrangler.data_api import _connector

import datetime as dt
import time
import uuid
from decimal import Decimal
from typing import TYPE_CHECKING, Any, Callable, TypeVar, cast
from awswrangler import _data_types, _databases, _utils, exceptions
from typing_extensions import Literal


def _create_value_dict( 
    value: Any,
) -> tuple[dict[str, Any], str | None]:
    if value is None:
        return {"isNull": True}, None
    
    if isinstance(value, list):
        if pd.isnull(value).all():
            return {"isNull": True}, None
        else:
            # value = [_create_value_dict(v)[0] for v in value]
            return {"arrayValue": {"doubleValues": value}}, None

    if isinstance(value, bool):
        return {"booleanValue": value}, None

    if isinstance(value, int):
        return {"longValue": value}, None

    if isinstance(value, float):
        return {"doubleValue": value}, None

    if isinstance(value, str):
        return {"stringValue": value}, None

    if isinstance(value, bytes):
        return {"blobValue": value}, None

    if isinstance(value, dt.datetime):
        return {"stringValue": str(value)}, "TIMESTAMP"

    if isinstance(value, dt.date):
        return {"stringValue": str(value)}, "DATE"

    if isinstance(value, dt.time):
        return {"stringValue": str(value)}, "TIME"

    if isinstance(value, Decimal):
        return {"stringValue": str(value)}, "DECIMAL"

    raise exceptions.InvalidArgumentType(f"Value {value} not supported.")


def _generate_parameters(columns: list[str], values: list[Any]) -> list[dict[str, Any]]:
    parameter_list = []

    for col, value in zip(columns, values):
        if(col == "embedding"):
            #value, type_hint = _create_value_dict(eval(value))  
            value, type_hint = _create_value_dict(value)  
        else:
            value, type_hint = _create_value_dict(value)  

        parameter = {
            "name": col,
            "value": value,
        }
        if type_hint:
            parameter["typeHint"] = type_hint

        parameter_list.append(parameter)

    return parameter_list

def _generate_parameter_sets(df: pd.DataFrame) -> list[list[dict[str, Any]]]:
    parameter_sets = []

    columns = df.columns.tolist()
    for values in df.values.tolist():
        parameter_sets.append(_generate_parameters(columns, values))

    return parameter_sets

print("In import data code")
data_client = boto3.client('rds-data')

s3_bucket_name = os.environ.get('BUCKET_NAME')


s3_embeddings_url = f"s3://{s3_bucket_name}/embeddings.csv"
df = wr.s3.read_csv(path=s3_embeddings_url);
parameterSets = _generate_parameter_sets(df)


print(parameterSets[0])


# connect to the rds clustee
cluster_arn = os.environ.get('CLUSTER_ARN')
db_name = os.environ.get('DATABASE_NAME')
secret_arn = os.environ.get('SECRET_ARN')


# enable the vector extension
# do this before running the task from the console

# create the table
table_name = "product_info"
sql_statement = f"CREATE TABLE IF NOT EXISTS {table_name} 
(product_id varchar, product_name varchar, category varchar,
discounted_price varchar, actual_price varchar, discount_percentage varchar,
rating varchar, rating_count varchar, about_product varchar, embedding vector);"
result = data_client.execute_statement(
    resourceArn=cluster_arn,
    secretArn=secret_arn,
    database=db_name,
    sql=sql_statement
)
print("created the table", result)

# write data to the table from the data frame
sql_statement = f"INSERT INTO {table_name} (product_id, product_name, category, 
discounted_price, actual_price, discount_percentage, rating, 
rating_count, about_product, embedding) 
VALUES (:product_id, :product_name, :category, :discounted_price, 
:actual_price, :discount_percentage, :rating, :rating_count, 
:about_product, :embedding::vector);"
# loop through the parameter sets and write to the table
for parameters in parameterSets:
    result = data_client.execute_statement(
        database=db_name,
        resourceArn=cluster_arn,
        secretArn=secret_arn,
        sql=sql_statement,
        parameters=parameters
    )
    time.sleep(0.1)  # sleep for a bit to avoid throttling errors 
    
print("wrote the data", result)

exit(0);    