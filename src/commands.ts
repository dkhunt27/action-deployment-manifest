import * as core from '@actions/core';
import {
  type ConfigurationType,
  type DeployableListItemType,
  type DeployableRecordType,
  type DeployedRecordType,
  DeploymentStatus,
  IfAddNewDeployableExists
} from './types';
import { setFailedAndCreateError } from './utilities';
import type { AssertUtilities } from './utilities-assert';
import type { CommandUtilities } from './utilities-commands';
import type { QueryUtilities } from './utilities-query';

export class CommandService {
  constructor(
    private readonly assertUtils: AssertUtilities,
    private readonly commandUtils: CommandUtilities,
    private readonly queryUtils: QueryUtilities,
    private readonly config: ConfigurationType
  ) {}

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

    // add deployable/version to deployable with status available
    for (const deployable of deployables) {
      // check if already exists before adding
      // TODO: this is query the ddb for each deployable, we can optimize this by doing one query for all deployables and checking in memory since we expect the number of deployables to be small
      const exists = await this.commandUtils.checkIfDeployableVersionExists<DeployableRecordType>({
        table: this.config.deployableTable,
        version,
        deployable
      });

      // if already exists, handle based on ifAddNewDeployableExists config
      if (exists) {
        switch (this.config.ifAddNewDeployableExists) {
          case IfAddNewDeployableExists.ERROR: {
            const errMsg = `addNewDeployable error: deployable ${deployable} with version ${version} already exists in table ${this.config.deployableTable}`;
            throw setFailedAndCreateError(errMsg);
          }
          case IfAddNewDeployableExists.IGNORE: {
            core.warning(
              `addNewDeployable warning: deployable ${deployable} with version ${version} already exists in table ${this.config.deployableTable}, skipping add`
            );
            continue;
          }
          case IfAddNewDeployableExists.OVERWRITE: {
            core.warning(
              `addNewDeployable warning: deployable ${deployable} with version ${version} already exists in table ${this.config.deployableTable}, overwriting record`
            );
            await this.commandUtils.putDeployableRecord({
              deployable,
              version,
              status: DeploymentStatus.AVAILABLE,
              actor
            });
            break;
          }
          default: {
            const errMsg = `addNewDeployable error: invalid config for ifAddNewDeployableExists: ${this.config.ifAddNewDeployableExists}`;
            throw setFailedAndCreateError(errMsg);
          }
        }
      } else {
        core.info(
          `addNewDeployable info: deployable ${deployable} with version ${version} does not exist in table ${this.config.deployableTable}, adding new record`
        );
        await this.commandUtils.putDeployableRecord({
          deployable,
          version,
          status: DeploymentStatus.AVAILABLE,
          actor
        });
      }
    }

    core.info(`Command completed`);
  };

  /**
   * handle get deployable list. (getDeployableList, version, deployables?)
   *   - assert deployable/version only has one record in deployable
   *   - if version starts with #.#.# then it is a specific version, return records with status not rejected that match version
   *   - otherwise assume version is actually an environment we want to get a list of all deployables and versions deployed there
   *   - if fallbackEnv (an env name) is set, fill in every deployable missing at version with the version deployed to that env
   */
  getDeployableList = async (params: {
    version: string;
    fallbackEnv?: string;
    deployables?: string[];
  }): Promise<DeployableListItemType[]> => {
    const { version, deployables = [] } = params;
    const fallbackEnv = params.fallbackEnv || undefined;
    try {
      let logMsg = `Getting deployable list for version ${version}`;
      logMsg +=
        deployables.length > 0
          ? ` restricting to deployables: ${deployables.join(', ')}`
          : ' (all deployables)';
      if (fallbackEnv) {
        logMsg += ` with fallback env ${fallbackEnv}`;
      }
      core.info(logMsg);

      // passing a version where an env belongs is the likely mix-up, so fail fast
      if (fallbackEnv && fallbackEnv.includes('.')) {
        throw new Error(
          `fallbackEnv must be an env name (e.g. "qa"), not a version: ${fallbackEnv}`
        );
      }

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

        // with a fallback env, a deployable missing at version is filled in from the fallback env instead of failing
        if (deployables.length > 0 && !fallbackEnv) {
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

      const result = fallbackEnv
        ? await this.addFallbackEnvDeployables({
            version,
            fallbackEnv,
            deployables,
            records: filtered
          })
        : filtered;

      core.info(`Command completed`);

      return result;
    } catch (error) {
      const errMsg = `getDeployableList error: ${error}`;
      throw setFailedAndCreateError(errMsg);
    }
  };

  /**
   * add fallback env deployables to the version records
   *   - version records always win
   *   - fallback env records skip the deployable table checks; they are already deployed to the fallback env so the artifact exists
   */
  private addFallbackEnvDeployables = async (params: {
    version: string;
    fallbackEnv: string;
    deployables: string[];
    records: DeployableListItemType[];
  }): Promise<DeployableListItemType[]> => {
    const { version, fallbackEnv, deployables, records } = params;
    const atVersion = new Set(records.map((item) => item.deployable));

    let fallbackRecords: DeployedRecordType[];
    let skipped: string[] = [];

    if (deployables.length === 0) {
      fallbackRecords = await this.queryUtils.queryRecordsByEnv<DeployedRecordType>({
        table: this.config.deployedTable,
        env: fallbackEnv
      });

      if (fallbackRecords.length === 0) {
        core.warning(
          `getDeployableList warning: fallback env "${fallbackEnv}" has no deployed records in table ${this.config.deployedTable}; returning only deployables at version ${version}`
        );
      }
    } else {
      const missing = [...new Set(deployables)].filter((d) => !atVersion.has(d));

      fallbackRecords =
        missing.length > 0
          ? await this.queryUtils.getDeployedRecordsByEnvAndDeployables<DeployedRecordType>({
              table: this.config.deployedTable,
              env: fallbackEnv,
              deployables: missing
            })
          : [];

      const inFallback = new Set(fallbackRecords.map((item) => item.deployable));
      skipped = missing.filter((d) => !inFallback.has(d));
      for (const deployable of skipped) {
        core.warning(`${deployable}: nothing at ${version} and nothing deployed to ${fallbackEnv}`);
      }

      // BatchGetItem returns items in no particular order; keep the caller's order
      fallbackRecords = missing.flatMap((d) =>
        fallbackRecords.filter((item) => item.deployable === d)
      );
    }

    const fromFallback = fallbackRecords
      .filter((item) => !atVersion.has(item.deployable))
      .map((item) => ({
        version: item.version,
        deployable: item.deployable,
        fromEnv: fallbackEnv
      }));

    let summary = `getDeployableList summary: ${records.length} from version ${version}, ${fromFallback.length} from fallback env ${fallbackEnv}`;
    if (skipped.length > 0) {
      summary += `, ${skipped.length} skipped`;
    }
    core.info(summary);

    return [...records, ...fromFallback];
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
