import * as core from '@actions/core';
import type { ConfigService } from './config-service';
import {
  type ConfigurationType,
  type DeployableRecordType,
  type DeployedRecordType,
  DeploymentStatus
} from './types';
import { setFailedAndCreateError } from './utilities';
import type { AssertUtilities } from './utilities-assert';
import type { CommandUtilities } from './utilities-commands';
import type { QueryUtilities } from './utilities-query';

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
   * handle new deployable (addNewDeployable, version, deployables)
   *   - assert deployable/version does not exist in deployable
   *   - add deployable/version to deployable with status available
   */
  addNewDeployable = async (params: {
    version: string;
    deployables: string[];
    actor: string;
  }): Promise<void> => {
    const { version, deployables, actor } = params;
    core.info(
      `Adding new deployable version ${version} for deployables: ${deployables.join(', ')} by actor ${actor}`
    );

    if (deployables.length === 0) {
      const errMsg = `addNewDeployable error: deployables cannot be empty`;
      throw setFailedAndCreateError(errMsg);
    }

    // assert deployable/version does not exist in deployable
    await this.assertUtils.assertDeployableVersionDoesNotExist<DeployableRecordType>({
      table: this.config.deployableTable,
      version,
      deployables
    });

    // add deployable/version to deployable with status available
    for (const deployable of deployables) {
      await this.commandUtils.putDeployableRecord({
        deployable,
        version,
        status: DeploymentStatus.AVAILABLE,
        actor
      });
    }

    core.info(`Command completed`);
  };

  /**
   * handle get deployable list. (getDeployableList, version, deployables?)
   *   - assert deployable/version only has one record in deployable
   *   - if version starts with #.#.# then it is a specific version, return records with status not rejected that match version
   *   - otherwise assume version is actually an environment we want to get a list of all deployables and versions deployed there
   */
  getDeployableList = async (params: {
    version: string;
    deployables?: string[];
  }): Promise<{ version: string; deployable: string }[]> => {
    const { version, deployables = [] } = params;
    try {
      let logMsg = `Getting deployable list for version ${version}`;
      logMsg +=
        deployables.length > 0
          ? ` restricting to deployables: ${deployables.join(', ')}`
          : ' (all deployables)';
      core.info(logMsg);

      let records: { version: string; deployable: string }[] = [];
      let table = '';

      if (/^\d+\.\d+\.\d+/.test(version)) {
        // version starts with #.#.# then it is a specific version, return records with status not rejected that match version
        table = this.config.deployableTable;

        const data = await this.queryUtils.queryRecordsByVersion<DeployableRecordType>({
          table,
          version
        });

        records = data
          .filter((item) => item.status !== 'rejected')
          .map((item) => ({ version: item.version, deployable: item.deployable }));

        if (deployables.length > 0) {
          // assert deployable/version only has one record in deployable
          await this.assertUtils.assertDeployableVersionRecordsExistsExactlyOnce({
            table,
            records,
            version,
            deployables
          });
        }
      } else {
        // otherwise assume version is actually an environment we want to get a list of all deployables and versions deployed there
        table = this.config.deployedTable;

        const data = await this.queryUtils.queryRecordsByEnv<DeployedRecordType>({
          table,
          env: version
        });

        records = data.map((item) => ({ version: item.version, deployable: item.deployable }));
      }

      const filtered =
        deployables.length > 0
          ? records.filter((item) => deployables.includes(item.deployable))
          : records;

      core.info(`Command completed`);

      return filtered;
    } catch (error) {
      const errMsg = `getDeployableList error: ${error}`;
      throw setFailedAndCreateError(errMsg);
    }
  };

  /**
   * handle deployed (markDeployed, version, env, deployables)
   *   - assert deployable/version exists in deployable exactly once
   *   - assert version/env exists in deployed no more than once
   *   - if env/deployable exists in deployed, update version
   *   - if env/deployable does not exist in deployed, add new record with version
   *   - if deployedToProd is true, update deployable
   *      - find deployable with status "rollback" and update to "decommissioned"
   *      - find deployable with status "prod" and update to "rollback"
   *      - find deployable/version set status to "prod"
   *   - if deployedToProd is not true, update deployable
   *      - find deployable/version set status to "pending"
   */
  markDeployed = async (params: {
    version: string;
    env: string;
    deployables: string[];
    actor: string;
    deployedToProd: boolean;
  }): Promise<void> => {
    const { version, env, deployables, actor, deployedToProd } = params;

    try {
      let logMsg = `Marking deployed to ${env} for version ${version} (deployedToProd: ${deployedToProd})`;
      logMsg +=
        deployables.length > 0
          ? ` restricting to deployables: ${deployables.join(', ')}`
          : ' (all deployables)';
      core.info(logMsg);

      // assert deployable/version exists in deployable exactly once
      this.assertUtils.assertDeployableVersionExistsExactlyOnce<DeployableRecordType>({
        table: this.config.deployableTable,
        version,
        deployables
      });

      // assert deployable/env exists in deployed no more than once
      this.assertUtils.assertDeployableEnvExistsOnceAtMost<DeployedRecordType>({
        env,
        deployables,
        table: this.config.deployedTable
      });

      // if env/deployable exists in deployed, update version
      // if env/deployable does not exist in deployed, add new record with version

      // doesn't matter if updating or adding, put will do both
      for (const deployable of deployables) {
        await this.commandUtils.putDeployedRecord({
          env,
          deployable,
          version,
          actor
        });
      }

      for (const deployable of deployables) {
        // need to get all deployable records with matching deployable and (version or have status rollback or prod)
        const deployableRecords =
          await this.commandUtils.getRelevantDeployableRecordsForMarkDeployed({
            deployableTable: this.config.deployableTable,
            deployable,
            version
          });

        if (deployedToProd) {
          // update status to decommissioned where deployable has status rollback
          // update status to rollback where deployable has status prod
          // update status to prod where deployable/version matches

          // Find records with rollback status for this deployable and update to decommissioned
          await this.commandUtils.updateDeployableRollbackRecordToDecommissioned({
            deployableTable: this.config.deployableTable,
            records: deployableRecords,
            deployable,
            actor
          });

          // Find records with prod status for this deployable and update to rollback
          await this.commandUtils.updateDeployableProdRecordToRollback({
            deployableTable: this.config.deployableTable,
            records: deployableRecords,
            deployable,
            actor
          });

          // Find the record that matches deployable/version and update to prod
          await this.commandUtils.updateDeployableVersionRecordToStatus({
            deployableTable: this.config.deployableTable,
            records: deployableRecords,
            status: DeploymentStatus.PROD,
            deployable,
            version,
            actor
          });
        } else {
          // if deployedToProd is not true, update deployable
          // find deployable/version set status to "pending"
          await this.commandUtils.updateDeployableVersionRecordToStatus({
            deployableTable: this.config.deployableTable,
            records: deployableRecords,
            status: DeploymentStatus.PENDING,
            deployable,
            version,
            actor
          });
        }
      }

      core.info(`Command completed`);
    } catch (error) {
      const errMsg = `markDeployed error: ${error}`;
      throw setFailedAndCreateError(errMsg);
    }
  };
}
