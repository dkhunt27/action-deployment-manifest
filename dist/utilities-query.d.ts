import type { AwsService } from './aws.ts';
export declare class QueryUtilities {
    private readonly awsService;
    constructor(awsService: AwsService);
    queryRecordsByVersion: <T>(params: {
        table: string;
        version: string;
    }) => Promise<T[]>;
    queryRecordsByApp: <T>(params: {
        table: string;
        app: string;
    }) => Promise<T[]>;
    queryRecordsByStatus: <T>(params: {
        table: string;
        status: string;
    }) => Promise<T[]>;
    queryRecordsByEnv: <T>(params: {
        table: string;
        env: string;
    }) => Promise<T[]>;
}
