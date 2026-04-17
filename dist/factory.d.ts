import type { DynamoDBClientConfig } from '@aws-sdk/client-dynamodb';
import { CommandService } from './commands';
import { IfAddNewDeployableExists } from './types';
export declare const buildCommandService: (params: {
    deployableTable: string;
    deployedTable: string;
    ifAddNewDeployableExists: IfAddNewDeployableExists;
    awsRegion?: string;
    ddbConfig?: DynamoDBClientConfig;
}) => Promise<CommandService>;
