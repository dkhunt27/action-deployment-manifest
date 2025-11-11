import type { AwsService } from './aws.ts';
import type { ConfigService } from './config-service.ts';
import { type DeployableRecordType, DeploymentStatus } from './types.ts';
import type { QueryUtilities } from './utilities-query.ts';
export declare class CommandUtilities {
    private readonly awsService;
    private readonly queryUtils;
    private readonly config;
    constructor(awsService: AwsService, queryUtils: QueryUtilities, configService: ConfigService);
    getRelevantDeployableRecordsForMarkDeployed: (params: {
        app: string;
        version: string;
        deployableTable: string;
    }) => Promise<DeployableRecordType[]>;
    updateDeployableRollbackRecordToDecommissioned: (params: {
        records: DeployableRecordType[];
        app: string;
        deployableTable: string;
        actor: string;
    }) => Promise<void>;
    updateDeployableProdRecordToRollback: (params: {
        records: DeployableRecordType[];
        app: string;
        deployableTable: string;
        actor: string;
    }) => Promise<void>;
    updateDeployableVersionRecordToStatus: (params: {
        deployableTable: string;
        records: DeployableRecordType[];
        app: string;
        version: string;
        actor: string;
        status: DeploymentStatus;
    }) => Promise<void>;
    putDeployableRecord: (params: {
        app: string;
        version: string;
        status: DeploymentStatus;
        actor: string;
    }) => Promise<void>;
    putDeployedRecord: (params: {
        env: string;
        app: string;
        version: string;
        actor: string;
    }) => Promise<void>;
}
