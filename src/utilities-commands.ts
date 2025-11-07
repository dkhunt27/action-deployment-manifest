import { PutCommandInput } from '@aws-sdk/lib-dynamodb';
import { AwsService } from './aws.ts';
import { ConfigService } from './config-service.ts';
import {
  ConfigurationType,
  DeployableRecordType,
  DeployedRecordType,
  DeploymentStatus
} from './types.ts';
import { QueryUtilities } from './utilities-query.ts';
import { buildDeployableKey, buildDeployedKey, setFailedAndCreateError } from './utilities.ts';

export class CommandUtilities {
  private readonly config: ConfigurationType;

  constructor(
    private readonly awsService: AwsService,
    private readonly queryUtils: QueryUtilities,
    configService: ConfigService
  ) {
    this.config = configService.config();
  }

  getRelevantDeployableRecordsForMarkDeployed = async (params: {
    app: string;
    version: string;
    deployableTable: string;
  }): Promise<DeployableRecordType[]> => {
    const { app, version, deployableTable } = params;

    // get all deployable records for this app
    const appRecords = await this.queryUtils.queryRecordsByApp<DeployableRecordType>({
      table: deployableTable,
      app
    });

    // keep records that match version or have status rollback or prod
    const relevantRecords = appRecords.filter(
      (record) =>
        record.version === version ||
        record.status === DeploymentStatus.ROLLBACK ||
        record.status === DeploymentStatus.PROD
    );

    return relevantRecords;
  };

  updateDeployableRollbackRecordToDecommissioned = async (params: {
    records: DeployableRecordType[];
    app: string;
    deployableTable: string;
    actor: string;
  }): Promise<void> => {
    const { records, app, deployableTable, actor } = params;

    // Find records with rollback status for this app and update to decommissioned
    const rollbackRecords = records.filter((record) => record.status === DeploymentStatus.ROLLBACK);

    if (rollbackRecords.length > 1) {
      const errMsg = `updateDeployableRollbackRecordToDecommissioned error: multiple rollback records found for app ${app} when only one expected`;
      throw setFailedAndCreateError(errMsg);
    }

    for (const record of rollbackRecords) {
      // this loop will only run once since we asserted above only one record exists or none if no records
      await this.awsService.update({
        input: {
          TableName: deployableTable,
          Key: { id: record.id },
          UpdateExpression:
            'SET #status = :status, modifiedDate = :modifiedDate, modifiedBy = :modifiedBy',
          ExpressionAttributeNames: {
            '#status': 'status'
          },
          ExpressionAttributeValues: {
            ':status': DeploymentStatus.DECOMMISSIONED,
            ':modifiedDate': new Date().toISOString(),
            ':modifiedBy': actor
          }
        }
      });
    }
  };

  updateDeployableProdRecordToRollback = async (params: {
    records: DeployableRecordType[];
    app: string;
    deployableTable: string;
    actor: string;
  }): Promise<void> => {
    const { records, app, deployableTable, actor } = params;

    // Find records with rollback status for this app and update to decommissioned
    const prodRecords = records.filter((record) => record.status === DeploymentStatus.PROD);

    if (prodRecords.length > 1) {
      const errMsg = `updateDeployableProdRecordToRollback error: multiple prod records found for app ${app} when only one expected`;
      throw setFailedAndCreateError(errMsg);
    }

    for (const record of prodRecords) {
      // this loop will only run once since we asserted above only one record exists or none if no records
      await this.awsService.update({
        input: {
          TableName: deployableTable,
          Key: { id: record.id },
          UpdateExpression:
            'SET #status = :status, modifiedDate = :modifiedDate, modifiedBy = :modifiedBy',
          ExpressionAttributeNames: {
            '#status': 'status'
          },
          ExpressionAttributeValues: {
            ':status': DeploymentStatus.ROLLBACK,
            ':modifiedDate': new Date().toISOString(),
            ':modifiedBy': actor
          }
        }
      });
    }
  };

  updateDeployableVersionRecordToStatus = async (params: {
    deployableTable: string;
    records: DeployableRecordType[];
    app: string;
    version: string;
    actor: string;
    status: DeploymentStatus;
  }): Promise<void> => {
    const { records, app, version, deployableTable, actor, status } = params;

    // Find records with rollback status for this app and update to decommissioned
    const versionRecords = records.filter((record) => record.version === version);

    if (versionRecords.length > 1) {
      const errMsg = `updateDeployableVersionRecordToStatus error: multiple version records found for app ${app} / version ${version} when only one expected`;
      throw setFailedAndCreateError(errMsg);
    }

    for (const record of versionRecords) {
      // this loop will only run once since we asserted above only one record exists or none if no records
      await this.awsService.update({
        input: {
          TableName: deployableTable,
          Key: { id: record.id },
          UpdateExpression:
            'SET #status = :status, modifiedDate = :modifiedDate, modifiedBy = :modifiedBy',
          ExpressionAttributeNames: {
            '#status': 'status'
          },
          ExpressionAttributeValues: {
            ':status': status,
            ':modifiedDate': new Date().toISOString(),
            ':modifiedBy': actor
          }
        }
      });
    }
  };

  putDeployableRecord = async (params: {
    app: string;
    version: string;
    status: DeploymentStatus;
    actor: string;
  }): Promise<void> => {
    const { app, version, status, actor } = params;

    const item: DeployableRecordType = {
      id: buildDeployableKey({ app, version }),
      version,
      app,
      status: status,
      modifiedDate: new Date().toISOString(),
      modifiedBy: actor
    };

    const input: PutCommandInput = {
      TableName: this.config.deployableTable,
      Item: item
    };

    try {
      await this.awsService.put({ input });
    } catch (err) {
      const errMsg = `putDeployableRecord failure:: input: ${JSON.stringify(input)}; error: ${err}`;
      throw setFailedAndCreateError(errMsg);
    }
  };

  putDeployedRecord = async (params: {
    env: string;
    app: string;
    version: string;
    actor: string;
  }): Promise<void> => {
    const { env, app, version, actor } = params;

    const item: DeployedRecordType = {
      id: buildDeployedKey({ app, env }),
      env,
      app,
      version,
      deployedDate: new Date().toISOString(),
      deployedBy: actor
    };

    const input: PutCommandInput = {
      TableName: this.config.deployedTable,
      Item: item
    };

    try {
      await this.awsService.put({ input });
    } catch (err) {
      const errMsg = `putDeployedRecord failure:: input: ${JSON.stringify(input)}; error: ${err}`;
      throw setFailedAndCreateError(errMsg);
    }
  };
}
