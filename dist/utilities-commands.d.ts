import type { AwsService } from './aws';
import type { ConfigService } from './config-service';
import { type DeployableRecordType, DeploymentStatus } from './types';
import type { QueryUtilities } from './utilities-query';
export declare class CommandUtilities {
    private readonly awsService;
    private readonly queryUtils;
    private readonly config;
    constructor(awsService: AwsService, queryUtils: QueryUtilities, configService: ConfigService);
    getRelevantDeployableRecordsForMarkDeployed: (params: {
        deployable: string;
        version: string;
        deployableTable: string;
    }) => Promise<DeployableRecordType[]>;
    updateDeployableRollbackRecordToDecommissioned: (params: {
        records: DeployableRecordType[];
        deployable: string;
        deployableTable: string;
        actor: string;
    }) => Promise<void>;
    updateDeployableProdRecordToRollback: (params: {
        records: DeployableRecordType[];
        deployable: string;
        deployableTable: string;
        actor: string;
    }) => Promise<void>;
    updateDeployableVersionRecordToStatus: (params: {
        deployableTable: string;
        records: DeployableRecordType[];
        deployable: string;
        version: string;
        actor: string;
        status: DeploymentStatus;
    }) => Promise<void>;
    putDeployableRecord: (params: {
        deployable: string;
        version: string;
        status: DeploymentStatus;
        actor: string;
    }) => Promise<void>;
    putDeployedRecord: (params: {
        env: string;
        deployable: string;
        version: string;
        actor: string;
    }) => Promise<void>;
}
