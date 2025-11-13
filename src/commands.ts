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
   *   - if version=latest, return all records with status "prod" (restrict to deployables if provided)
   *   - if version!=latest, return records with status not rejected that match version (restrict to deployables if provided)
   */
  getDeployableList = async (params: {
    version: string;
    deployables?: string[];
  }): Promise<DeployableRecordType[]> => {
    const { version, deployables = [] } = params;
    try {
      let logMsg = `Getting deployable list for version ${version}`;
      logMsg +=
        deployables.length > 0
          ? ` restricting to deployables: ${deployables.join(', ')}`
          : ' (all deployables)';
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

      if (deployables.length > 0) {
        // assert deployable/version only has one record in deployable
        await this.assertUtils.assertDeployableVersionRecordsExistsExactlyOnce<DeployableRecordType>(
          {
            table: this.config.deployableTable,
            records,
            version,
            deployables
          }
        );
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
