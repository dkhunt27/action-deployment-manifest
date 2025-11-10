import { type DynamoDBClientConfig } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, type PutCommandInput, type PutCommandOutput, type QueryCommandInput, type UpdateCommandInput, type UpdateCommandOutput } from '@aws-sdk/lib-dynamodb';
import type { marshallOptions, unmarshallOptions } from '@aws-sdk/util-dynamodb';
export declare class AwsService {
    private awsDdbDocClient;
    constructor(config?: DynamoDBClientConfig);
    ddbDocClient: () => DynamoDBDocumentClient;
    private buildTranslateConfig;
    init: (params?: {
        config?: DynamoDBClientConfig;
        marshallOptions?: marshallOptions;
        unmarshallOptions?: unmarshallOptions;
        disableXray?: boolean;
    }) => Promise<void>;
    getAllQueryItems: (params: {
        input: QueryCommandInput;
    }) => Promise<Record<string, unknown>[]>;
    put: (params: {
        input: PutCommandInput;
        ignoreConditionExpressionFailedException?: boolean;
    }) => Promise<PutCommandOutput>;
    update: (params: {
        input: UpdateCommandInput;
    }) => Promise<UpdateCommandOutput>;
}
