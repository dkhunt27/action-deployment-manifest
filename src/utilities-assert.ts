import { setFailedAndCreateError } from './utilities.ts';
import type { QueryUtilities } from './utilities-query.ts';

export class AssertUtilities {
  constructor(private readonly queryUtils: QueryUtilities) {}

  assertDeployableVersionDoesNotExist = async <T extends { deployable: string }>(params: {
    version: string;
    deployables: string[];
    table: string;
  }): Promise<void> => {
    const { version, deployables, table } = params;

    const records = await this.queryUtils.queryRecordsByVersion<T>({
      table,
      version
    });

    // Check that each deployable in deployables does not exists for this version
    for (const deployable of deployables) {
      const matchingRecords = records.filter((record) => record.deployable === deployable);

      if (matchingRecords.length >= 1) {
        const errMsg = `assertDeployableVersionDoesNotExist (table: ${table}):: record(s) (${matchingRecords.length}) found for version: ${version} and deployable: ${deployable}`;
        throw setFailedAndCreateError(errMsg);
      }
    }
  };

  assertDeployableVersionExistsExactlyOnce = async <T extends { deployable: string }>(params: {
    version: string;
    deployables: string[];
    table: string;
  }): Promise<void> => {
    const { version, deployables, table } = params;

    const records = await this.queryUtils.queryRecordsByVersion<T>({
      table,
      version
    });

    this.assertDeployableVersionRecordsExistsExactlyOnce({
      records,
      version,
      deployables,
      table
    });
  };

  assertDeployableVersionRecordsExistsExactlyOnce = async <
    T extends { deployable: string }
  >(params: {
    records: T[];
    version: string;
    deployables: string[];
    table: string;
  }): Promise<void> => {
    const { version, deployables, table } = params;

    const records = await this.queryUtils.queryRecordsByVersion<T>({
      table,
      version
    });

    if (!records || records.length === 0) {
      const errMsg = `assertDeployableVersionRecordsExistsExactlyOnce (table: ${table}):: no record(s) found for version: ${version}`;
      throw setFailedAndCreateError(errMsg);
    }

    // IN is not support in DynamoDb queries, so we have to check deployables manually
    // Check that each deployable in deployables exists exactly once for this version
    for (const deployable of deployables) {
      const matchingRecords = records.filter((record) => record.deployable === deployable);

      if (matchingRecords.length === 0) {
        const errMsg = `assertDeployableVersionRecordsExistsExactlyOnce (table: ${table}):: no record found for version: ${version} and deployable: ${deployable}`;
        throw setFailedAndCreateError(errMsg);
      }

      if (matchingRecords.length > 1) {
        const errMsg = `assertDeployableVersionRecordsExistsExactlyOnce (table: ${table}):: multiple records (${matchingRecords.length}) found for version: ${version} and deployable: ${deployable}`;
        throw setFailedAndCreateError(errMsg);
      }
    }
  };

  assertDeployableVersionExistsOnceAtMost = async <T extends { deployable: string }>(params: {
    version: string;
    deployables: string[];
    table: string;
  }): Promise<void> => {
    const { table, version, deployables } = params;

    const records = await this.queryUtils.queryRecordsByVersion<T>({
      table,
      version
    });

    // IN is not support in DynamoDb queries, so we have to check deployables manually
    // Check that each deployable in deployables exists at most once for this version
    for (const deployable of deployables) {
      const matchingRecords = records.filter((record) => record.deployable === deployable);

      if (matchingRecords.length > 1) {
        const errMsg = `assertDeployableVersionExistsOnceAtMost (table: ${table}):: multiple records (${matchingRecords.length}) found for version: ${version} and deployable: ${deployable}`;
        throw setFailedAndCreateError(errMsg);
      }
    }
  };

  assertDeployableEnvExistsOnceAtMost = async <T extends { deployable: string }>(params: {
    env: string;
    deployables: string[];
    table: string;
  }): Promise<void> => {
    const { table, env, deployables } = params;

    const records = await this.queryUtils.queryRecordsByEnv<T>({ table, env });

    // IN is not support in DynamoDb queries, so we have to check deployables manually
    // Check that each deployable in deployables exists at most once for this version
    for (const deployable of deployables) {
      const matchingRecords = records.filter((record) => record.deployable === deployable);

      if (matchingRecords.length > 1) {
        const errMsg = `assertDeployableEnvExistsOnceAtMost (table: ${table}):: multiple records (${matchingRecords.length}) found for env: ${env} and deployable: ${deployable}`;
        throw setFailedAndCreateError(errMsg);
      }
    }
  };
}
