import * as core from '@actions/core';
import { buildDeployableKey, buildDeployedKey, setFailedAndCreateError } from './utilities.ts';
import { batchWritePutAll, update } from './aws.ts';
import { DeployableRecordType, DeployedRecordType, DeploymentStatus } from './types.ts';
import {
  assertAppEnvExistsOnceAtMost,
  assertAppVersionDoesNotExist,
  assertAppVersionExistsExactlyOnce
} from './utilities-assert.ts';
import {
  queryRecordsByApp,
  queryRecordsByStatus,
  queryRecordsByVersion
} from './utilities-query.ts';
import {
  getRelevantDeployableRecordsForMarkDeployed,
  updateDeployableProdRecordToRollback,
  updateDeployableRollbackRecordToDecommissioned,
  updateDeployableVersionRecordToStatus
} from './utilities-commands.ts';

export class DeploymentManifestCommands {
  private readonly deployableTable: string;
  private readonly deployedTable: string;

  constructor(deployableTable: string, deployedTable: string) {
    this.deployableTable = deployableTable;
    this.deployedTable = deployedTable;
  }
  /**
   * handle new deployable (addNewDeployable, version, appList)
   *   - assert app/version does not exist in deployable
   *   - add app/version to deployable with status available
   */
  addNewDeployable = async (params: {
    version: string;
    appList: string[];
    actor: string;
  }): Promise<void> => {
    const { version, appList, actor } = params;
    core.info(
      `Adding new deployable version ${version} for apps: ${appList.join(', ')} by actor ${actor}`
    );

    // assert app/version does not exist in deployable
    const records = await queryRecordsByVersion<DeployableRecordType>({
      table: this.deployableTable,
      version
    });

    await assertAppVersionDoesNotExist<DeployableRecordType>({
      table: this.deployableTable,
      records,
      version,
      appList
    });

    // add app/version to deployable with status available
    try {
      const data = appList.map((item) => {
        return {
          id: buildDeployableKey({ app: item, version }),
          version,
          app: item,
          status: 'available',
          createdDate: new Date().toISOString(),
          createdBy: actor
        };
      });
      await batchWritePutAll({ tableName: this.deployableTable, data });
    } catch (err) {
      const errMsg = `addNewDeployable (table: ${this.deployableTable}):: could not put data for version: ${version} and appList: ${appList}; error: ${err}`;
      throw setFailedAndCreateError(errMsg);
    }
  };

  /**
   * handle get deployable list. (getDeployableList, version, appList?)
   *   - assert app/version only has one record in deployable
   *   - if version=latest, return all records with status "prod" (restrict to appList if provided)
   *   - if version!=latest, return records with status not rejected that match version (restrict to appList if provided)
   */
  getDeployableList = async (params: {
    version: string;
    appList?: string[];
  }): Promise<DeployableRecordType[]> => {
    const { version, appList = [] } = params;
    try {
      let logMsg = `Getting deployable list for version ${version}`;
      logMsg += appList.length > 0 ? ` restricting to apps: ${appList.join(', ')}` : ' (all apps)';
      core.info(logMsg);

      let records: DeployableRecordType[] = [];
      if (version === 'latest') {
        // if version=latest, return all records with status "prod"
        records = await queryRecordsByStatus<DeployableRecordType>({
          table: this.deployableTable,
          status: 'prod'
        });
      } else {
        // if version!=latest, return records with status not rejected that match version
        const all = await queryRecordsByVersion<DeployableRecordType>({
          table: this.deployableTable,
          version
        });

        records = all.filter((item) => item.status !== 'rejected');
      }

      if (appList.length > 0) {
        // assert app/version only has one record in deployable
        await assertAppVersionExistsExactlyOnce<DeployableRecordType>({
          table: this.deployableTable,
          records,
          version,
          appList
        });
      }

      const filtered =
        appList.length > 0 ? records.filter((item) => appList.includes(item.app)) : records;

      return filtered;
    } catch (error) {
      const errMsg = `getDeployableList error: ${error}`;
      throw setFailedAndCreateError(errMsg);
    }
  };

  /**
   * handle deployed (markDeployed, version, env, appList)
   *   - assert app/version exists in deployable exactly once
   *   - assert version/env exists in deployed no more than once
   *   - if env/app exists in deployed, update version
   *   - if env/app does not exist in deployed, add new record with version
   *   - if deployedToProd is true, update deployable
   *      - find app with status "rollback" and update to "decommissioned"
   *      - find app with status "prod" and update to "rollback"
   *      - find app/version set status to "prod"
   *   - if deployedToProd is not true, update deployable
   *      - find app/version set status to "pending"
   */
  markDeployed = async (params: {
    version: string;
    env: string;
    appList: string[];
    actor: string;
    deployedToProd: boolean;
  }): Promise<void> => {
    const { version, env, appList, actor, deployedToProd } = params;

    try {
      let logMsg = `Marking deployable as rejected for version ${version}`;
      logMsg += appList.length > 0 ? ` restricting to apps: ${appList.join(', ')}` : ' (all apps)';
      core.info(logMsg);

      // assert app/version exists in deployable exactly once
      const deployables = await queryRecordsByVersion<DeployableRecordType>({
        table: this.deployableTable,
        version
      });

      assertAppVersionExistsExactlyOnce<DeployableRecordType>({
        records: deployables,
        table: this.deployableTable,
        version,
        appList
      });

      // assert app/env exists in deployed no more than once
      const deployed = await queryRecordsByVersion<DeployedRecordType>({
        table: this.deployedTable,
        version
      });

      assertAppEnvExistsOnceAtMost<DeployedRecordType>({
        records: deployed,
        version,
        appList,
        table: this.deployedTable
      });

      // if env/app exists in deployed, update version
      // if env/app does not exist in deployed, add new record with version

      // doesn't matter if updating or adding, batchWritePutAll will do both
      const data = appList.map((item) => {
        return {
          id: buildDeployedKey({ app: item, env }),
          env,
          app: item,
          version,
          deployedDate: new Date().toISOString(),
          deployedBy: actor
        } as DeployedRecordType;
      });
      await batchWritePutAll({ tableName: this.deployedTable, data });

      for (const app of appList) {
        // need to get all deployable records with matching app and (version or have status rollback or prod)
        const deployableRecords = await getRelevantDeployableRecordsForMarkDeployed({
          deployableTable: this.deployableTable,
          app,
          version
        });

        if (deployedToProd) {
          // update status to decommissioned where app has status rollback
          // update status to rollback where app has status prod
          // update status to prod where app/version matches

          for (const app of appList) {
            // Find records with rollback status for this app and update to decommissioned
            updateDeployableRollbackRecordToDecommissioned({
              deployableTable: this.deployableTable,
              records: deployableRecords,
              app,
              actor
            });

            // Find records with prod status for this app and update to rollback
            updateDeployableProdRecordToRollback({
              deployableTable: this.deployableTable,
              records: deployableRecords,
              app,
              actor
            });

            // Find the record that matches app/version and update to prod
            updateDeployableVersionRecordToStatus({
              deployableTable: this.deployableTable,
              records: deployableRecords,
              status: DeploymentStatus.PROD,
              app,
              version,
              actor
            });
          }
        } else {
          // if deployedToProd is not true, update deployable
          // find app/version set status to "pending"
          updateDeployableVersionRecordToStatus({
            deployableTable: this.deployableTable,
            records: deployableRecords,
            status: DeploymentStatus.PENDING,
            app,
            version,
            actor
          });
        }
      }
    } catch (error) {
      const errMsg = `markDeployed error: ${error}`;
      throw setFailedAndCreateError(errMsg);
    }
  };

  /**
   * handle rejected (markRejected, version, appList?)
   * assert app/version only has one record in deployable
   * if appList is empty, mark all apps for that version as rejected
   * if appList is provided, mark only those apps as rejected
   */
  markRejected = async (params: {
    version: string;
    actor: string;
    appList?: string[];
  }): Promise<void> => {
    const { version, actor, appList = [] } = params;
    try {
      let logMsg = `Marking deployable as rejected for version ${version} by actor ${actor}`;
      logMsg += appList.length > 0 ? ` restricting to apps: ${appList.join(', ')}` : ' (all apps)';
      core.info(logMsg);

      // handle rejected (markRejected, version, appList?)
      // assert app/version only has one record in deployable
      // if appList is empty, mark all apps for that version as rejected
      // if appList is provided, mark only those apps as rejected
    } catch (error) {
      const errMsg = `markRejected error: ${error}`;
      throw setFailedAndCreateError(errMsg);
    }
  };
}
