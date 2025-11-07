import { queryRecordsByVersion } from './utilities-query.ts';
import { setFailedAndCreateError } from './utilities.ts';

export const assertAppVersionDoesNotExist = async <T extends { app: string }>(params: {
  version: string;
  appList: string[];
  table: string;
}): Promise<void> => {
  const { version, appList, table } = params;

  const records = await queryRecordsByVersion<T>({
    table,
    version
  });

  // Check that each app in appList does not exists for this version
  for (const app of appList) {
    const matchingRecords = records.filter((record) => record.app === app);

    if (matchingRecords.length >= 1) {
      const errMsg = `assertAppVersionDoesNotExist (table: ${table}):: record(s) (${matchingRecords.length}) found for version: ${version} and app: ${app}`;
      throw setFailedAndCreateError(errMsg);
    }
  }
};

export const assertAppVersionExistsExactlyOnce = async <T extends { app: string }>(params: {
  version: string;
  appList: string[];
  table: string;
}): Promise<void> => {
  const { version, appList, table } = params;

  const records = await queryRecordsByVersion<T>({
    table,
    version
  });

  assertAppVersionRecordsExistsExactlyOnce({
    records,
    version,
    appList,
    table
  });
};

export const assertAppVersionRecordsExistsExactlyOnce = async <T extends { app: string }>(params: {
  records: T[];
  version: string;
  appList: string[];
  table: string;
}): Promise<void> => {
  const { version, appList, table } = params;

  const records = await queryRecordsByVersion<T>({
    table,
    version
  });

  if (!records || records.length === 0) {
    const errMsg = `assertAppVersionRecordsExistsExactlyOnce (table: ${table}):: no record(s) found for version: ${version}`;
    throw setFailedAndCreateError(errMsg);
  }

  // IN is not support in DynamoDb queries, so we have to check appList manually
  // Check that each app in appList exists exactly once for this version
  for (const app of appList) {
    const matchingRecords = records.filter((record) => record.app === app);

    if (matchingRecords.length === 0) {
      const errMsg = `assertAppVersionRecordsExistsExactlyOnce (table: ${table}):: no record found for version: ${version} and app: ${app}`;
      throw setFailedAndCreateError(errMsg);
    }

    if (matchingRecords.length > 1) {
      const errMsg = `assertAppVersionRecordsExistsExactlyOnce (table: ${table}):: multiple records (${matchingRecords.length}) found for version: ${version} and app: ${app}`;
      throw setFailedAndCreateError(errMsg);
    }
  }
};

export const assertAppVersionExistsOnceAtMost = async <T extends { app: string }>(params: {
  version: string;
  appList: string[];
  table: string;
}): Promise<void> => {
  const { table, version, appList } = params;

  const records = await queryRecordsByVersion<T>({
    table,
    version
  });

  // IN is not support in DynamoDb queries, so we have to check appList manually
  // Check that each app in appList exists at most once for this version
  for (const app of appList) {
    const matchingRecords = records.filter((record) => record.app === app);

    if (matchingRecords.length > 1) {
      const errMsg = `assertAppVersionExistsOnceAtMost (table: ${table}):: multiple records (${matchingRecords.length}) found for version: ${version} and app: ${app}`;
      throw setFailedAndCreateError(errMsg);
    }
  }
};

export const assertAppEnvExistsOnceAtMost = async <T extends { app: string }>(params: {
  version: string;
  appList: string[];
  table: string;
}): Promise<void> => {
  const { table, version, appList } = params;

  const records = await queryRecordsByVersion<T>({
    table,
    version
  });

  // IN is not support in DynamoDb queries, so we have to check appList manually
  // Check that each app in appList exists at most once for this version
  for (const app of appList) {
    const matchingRecords = records.filter((record) => record.app === app);

    if (matchingRecords.length > 1) {
      const errMsg = `assertVersionAppExistsOnceAtMost (table: ${table}):: multiple records (${matchingRecords.length}) found for version: ${version} and app: ${app}`;
      throw setFailedAndCreateError(errMsg);
    }
  }
};
