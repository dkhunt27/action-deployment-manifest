import type { AwsService } from './aws';
export declare class QueryUtilities {
    private readonly awsService;
    constructor(awsService: AwsService);
    queryRecordsByVersion: <T>(params: {
        table: string;
        version: string;
    }) => Promise<T[]>;
    queryRecordsByDeployable: <T>(params: {
        table: string;
        deployable: string;
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
