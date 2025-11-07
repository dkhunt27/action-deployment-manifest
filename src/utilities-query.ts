import { setFailedAndCreateError } from './utilities.ts';
import { getAllQueryItems } from './aws.ts';
import { QueryCommandInput } from '@aws-sdk/lib-dynamodb';

const VERSION_INDEX_NAME = 'version-index';
const STATUS_INDEX_NAME = 'status-index';
const APP_INDEX_NAME = 'app-index';

export const queryRecordsByVersion = async <T>(params: { table: string; version: string }): Promise<T[]> => {
  const { table, version } = params;

  let result: Record<string, unknown>[];
  try {
    const input: QueryCommandInput = {
      TableName: table,
      IndexName: VERSION_INDEX_NAME,
      KeyConditionExpression: 'version = :version',
      ExpressionAttributeValues: {
        ':version': version
      }
    };
    result = await getAllQueryItems({ input });
    return (result || []) as T[];
  } catch (err) {
    const errMsg = `queryRecordsByVersion (table: ${table}):: could not get data for version: ${version}; error: ${err}`;
    throw setFailedAndCreateError(errMsg);
  }
};

export const queryRecordsByApp = async <T>(params: { table: string; app: string }): Promise<T[]> => {
  const { table, app } = params;

  let result: Record<string, unknown>[];
  try {
    const input: QueryCommandInput = {
      TableName: table,
      IndexName: APP_INDEX_NAME,
      KeyConditionExpression: 'app = :app',
      ExpressionAttributeValues: {
        ':app': app
      }
    };
    result = await getAllQueryItems({ input });
    return (result || []) as T[];
  } catch (err) {
    const errMsg = `queryRecordsByApp (table: ${table}):: could not get data for app: ${app}; error: ${err}`;
    throw setFailedAndCreateError(errMsg);
  }
};

export const queryRecordsByStatus = async <T>(params: { table: string; status: string }): Promise<T[]> => {
  const { table, status } = params;

  let result: Record<string, unknown>[];
  try {
    const input: QueryCommandInput = {
      TableName: table,
      IndexName: STATUS_INDEX_NAME,
      KeyConditionExpression: '#status = :status',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':status': status
      }
    };
    result = await getAllQueryItems({ input });
    return (result || []) as T[];
  } catch (err) {
    const errMsg = `queryDeployableRecordsByStatus (table: ${table}):: could not get data for status: ${status}; error: ${err}`;
    throw setFailedAndCreateError(errMsg);
  }
};
