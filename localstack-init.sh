#!/bin/bash

REGION="us-east-1"
DEPLOYABLE_TABLE="deployable"
DEPLOYED_TABLE="deployed"

aws dynamodb create-table \
    --endpoint-url=http://localhost.localstack.cloud:4566 \
    --no-cli-pager \
    --billing-mode PAY_PER_REQUEST \
    --table-name $DEPLOYABLE_TABLE \
    --region $REGION \
    --attribute-definitions \
        AttributeName=id,AttributeType=S \
        AttributeName=version,AttributeType=S \
        AttributeName=app,AttributeType=S \
        AttributeName=status,AttributeType=S \
    --key-schema AttributeName=id,KeyType=HASH \
    --global-secondary-indexes \
        '[
        {
            "IndexName": "version-index",
            "KeySchema": [
                {
                    "AttributeName": "version",
                    "KeyType": "HASH"
                }
            ],
            "Projection": {
                "ProjectionType": "ALL"
            }
        },
        {
            "IndexName": "app-index",
            "KeySchema": [
                {
                    "AttributeName": "app",
                    "KeyType": "HASH"
                }
            ],
            "Projection": {
                "ProjectionType": "ALL"
            }
        },
        {
            "IndexName": "status-index",
            "KeySchema": [
                {
                    "AttributeName": "status",
                    "KeyType": "HASH"
                }
            ],
            "Projection": {
                "ProjectionType": "ALL"
            }
        }
        ]'

# create deployed table
aws dynamodb create-table \
    --endpoint-url=http://localhost.localstack.cloud:4566 \
    --no-cli-pager \
    --billing-mode PAY_PER_REQUEST \
    --table-name $DEPLOYED_TABLE \
    --region $REGION \
    --attribute-definitions \
        AttributeName=id,AttributeType=S \
        AttributeName=version,AttributeType=S \
        AttributeName=app,AttributeType=S \
        AttributeName=env,AttributeType=S \
    --key-schema AttributeName=id,KeyType=HASH \
    --global-secondary-indexes \
        '[
        {
            "IndexName": "version-index",
            "KeySchema": [
                {
                    "AttributeName": "version",
                    "KeyType": "HASH"
                }
            ],
            "Projection": {
                "ProjectionType": "ALL"
            }
        },
        {
            "IndexName": "app-index",
            "KeySchema": [
                {
                    "AttributeName": "app",
                    "KeyType": "HASH"
                }
            ],
            "Projection": {
                "ProjectionType": "ALL"
            }
        },
        {
            "IndexName": "env-index",
            "KeySchema": [
                {
                    "AttributeName": "env",
                    "KeyType": "HASH"
                }
            ],
            "Projection": {
                "ProjectionType": "ALL"
            }
        }
        ]'

aws dynamodb list-tables \
    --endpoint-url=http://localhost.localstack.cloud:4566 \
    --region=$REGION \
    --no-cli-pager

echo "DynamoDB tables created in LocalStack."
