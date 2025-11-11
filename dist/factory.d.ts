import type { DynamoDBClientConfig } from '@aws-sdk/client-dynamodb';
import { CommandService } from './commands.ts';
export declare const buildCommandService: (params: {
    deployableTable: string;
    deployedTable: string;
    awsRegion?: string;
    config?: DynamoDBClientConfig;
}) => Promise<CommandService>;
