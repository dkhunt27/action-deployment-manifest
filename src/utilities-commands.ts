import { update } from './aws.ts';
import { DeployableRecordType, DeploymentStatus } from './types.ts';
import { queryRecordsByApp } from './utilities-query.ts';
import { setFailedAndCreateError } from './utilities.ts';

export const getRelevantDeployableRecordsForMarkDeployed = async (params: {
  app: string;
  version: string;
  deployableTable: string;
}): Promise<DeployableRecordType[]> => {
  const { app, version, deployableTable } = params;

  // get all deployable records for this app
  const appRecords = await queryRecordsByApp<DeployableRecordType>({
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

export const updateDeployableRollbackRecordToDecommissioned = async (params: {
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
    await update({
      input: {
        TableName: deployableTable,
        Key: { id: record.id },
        UpdateExpression:
          'SET #status = :status, updatedDate = :updatedDate, updatedBy = :updatedBy',
        ExpressionAttributeNames: {
          '#status': 'status'
        },
        ExpressionAttributeValues: {
          ':status': DeploymentStatus.DECOMMISSIONED,
          ':updatedDate': new Date().toISOString(),
          ':updatedBy': actor
        }
      }
    });
  }
};

export const updateDeployableProdRecordToRollback = async (params: {
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
    await update({
      input: {
        TableName: deployableTable,
        Key: { id: record.id },
        UpdateExpression:
          'SET #status = :status, updatedDate = :updatedDate, updatedBy = :updatedBy',
        ExpressionAttributeNames: {
          '#status': 'status'
        },
        ExpressionAttributeValues: {
          ':status': DeploymentStatus.ROLLBACK,
          ':updatedDate': new Date().toISOString(),
          ':updatedBy': actor
        }
      }
    });
  }
};

export const updateDeployableVersionRecordToStatus = async (params: {
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
    await update({
      input: {
        TableName: deployableTable,
        Key: { id: record.id },
        UpdateExpression:
          'SET #status = :status, updatedDate = :updatedDate, updatedBy = :updatedBy',
        ExpressionAttributeNames: {
          '#status': 'status'
        },
        ExpressionAttributeValues: {
          ':status': status,
          ':updatedDate': new Date().toISOString(),
          ':updatedBy': actor
        }
      }
    });
  }
};
