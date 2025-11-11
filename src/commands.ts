import * as core from '@actions/core';
import type { ConfigService } from './config-service.ts';
import {
  type ConfigurationType,
  type DeployableRecordType,
  type DeployedRecordType,
  DeploymentStatus
} from './types.ts';
import { setFailedAndCreateError } from './utilities.ts';
import type { AssertUtilities } from './utilities-assert.ts';
import type { CommandUtilities } from './utilities-commands.ts';
import type { QueryUtilities } from './utilities-query.ts';

export class CommandService {
  private readonly config: ConfigurationType;

  constructor(
    private readonly assertUtils: AssertUtilities,
    private readonly commandUtils: CommandUtilities,
    private readonly queryUtils: QueryUtilities,
    configService: ConfigService
  ) {
    this.config = configService.config();
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

    if (appList.length === 0) {
      const errMsg = `addNewDeployable error: appList cannot be empty`;
      throw setFailedAndCreateError(errMsg);
    }

    // assert app/version does not exist in deployable
    await this.assertUtils.assertAppVersionDoesNotExist<DeployableRecordType>({
      table: this.config.deployableTable,
      version,
      appList
    });

    // add app/version to deployable with status available
    for (const app of appList) {
      await this.commandUtils.putDeployableRecord({
        app,
        version,
        status: DeploymentStatus.AVAILABLE,
        actor
      });
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
        records = await this.queryUtils.queryRecordsByStatus<DeployableRecordType>({
          table: this.config.deployableTable,
          status: 'prod'
        });
      } else {
        // if version!=latest, return records with status not rejected that match version
        const all = await this.queryUtils.queryRecordsByVersion<DeployableRecordType>({
          table: this.config.deployableTable,
          version
        });

        records = all.filter((item) => item.status !== 'rejected');
      }

      if (appList.length > 0) {
        // assert app/version only has one record in deployable
        await this.assertUtils.assertAppVersionRecordsExistsExactlyOnce<DeployableRecordType>({
          table: this.config.deployableTable,
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
      let logMsg = `Marking deployed to ${env} for version ${version} (deployedToProd: ${deployedToProd})`;
      logMsg += appList.length > 0 ? ` restricting to apps: ${appList.join(', ')}` : ' (all apps)';
      core.info(logMsg);

      // assert app/version exists in deployable exactly once
      this.assertUtils.assertAppVersionExistsExactlyOnce<DeployableRecordType>({
        table: this.config.deployableTable,
        version,
        appList
      });

      // assert app/env exists in deployed no more than once
      this.assertUtils.assertAppEnvExistsOnceAtMost<DeployedRecordType>({
        env,
        appList,
        table: this.config.deployedTable
      });

      // if env/app exists in deployed, update version
      // if env/app does not exist in deployed, add new record with version

      // doesn't matter if updating or adding, put will do both
      for (const app of appList) {
        await this.commandUtils.putDeployedRecord({
          env,
          app,
          version,
          actor
        });
      }

      for (const app of appList) {
        // need to get all deployable records with matching app and (version or have status rollback or prod)
        const deployableRecords =
          await this.commandUtils.getRelevantDeployableRecordsForMarkDeployed({
            deployableTable: this.config.deployableTable,
            app,
            version
          });

        if (deployedToProd) {
          // update status to decommissioned where app has status rollback
          // update status to rollback where app has status prod
          // update status to prod where app/version matches

          // Find records with rollback status for this app and update to decommissioned
          await this.commandUtils.updateDeployableRollbackRecordToDecommissioned({
            deployableTable: this.config.deployableTable,
            records: deployableRecords,
            app,
            actor
          });

          // Find records with prod status for this app and update to rollback
          await this.commandUtils.updateDeployableProdRecordToRollback({
            deployableTable: this.config.deployableTable,
            records: deployableRecords,
            app,
            actor
          });

          // Find the record that matches app/version and update to prod
          await this.commandUtils.updateDeployableVersionRecordToStatus({
            deployableTable: this.config.deployableTable,
            records: deployableRecords,
            status: DeploymentStatus.PROD,
            app,
            version,
            actor
          });
        } else {
          // if deployedToProd is not true, update deployable
          // find app/version set status to "pending"
          await this.commandUtils.updateDeployableVersionRecordToStatus({
            deployableTable: this.config.deployableTable,
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
}
