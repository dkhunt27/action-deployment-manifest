import type { QueryCommandInput } from '@aws-sdk/lib-dynamodb';
import type { AwsService } from './aws';
import { setFailedAndCreateError } from './utilities';

const ENV_INDEX_NAME = 'env-index';
const VERSION_INDEX_NAME = 'version-index';
const STATUS_INDEX_NAME = 'status-index';
const DEPLOYABLE_INDEX_NAME = 'deployable-index';

export class QueryUtilities {
  constructor(private readonly awsService: AwsService) {}

  queryRecordsByVersion = async <T>(params: { table: string; version: string }): Promise<T[]> => {
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
      result = await this.awsService.getAllQueryItems({ input });
      return (result || []) as T[];
    } catch (err) {
      const errMsg = `queryRecordsByVersion (table: ${table}):: could not get data for version: ${version}; error: ${err}`;
      throw setFailedAndCreateError(errMsg);
    }
  };

  queryRecordsByDeployable = async <T>(params: {
    table: string;
    deployable: string;
  }): Promise<T[]> => {
    const { table, deployable } = params;

    let result: Record<string, unknown>[];
    try {
      const input: QueryCommandInput = {
        TableName: table,
        IndexName: DEPLOYABLE_INDEX_NAME,
        KeyConditionExpression: 'deployable = :deployable',
        ExpressionAttributeValues: {
          ':deployable': deployable
        }
      };
      result = await this.awsService.getAllQueryItems({ input });
      return (result || []) as T[];
    } catch (err) {
      const errMsg = `queryRecordsByDeployable (table: ${table}):: could not get data for deployable: ${deployable}; error: ${err}`;
      throw setFailedAndCreateError(errMsg);
    }
  };

  queryRecordsByStatus = async <T>(params: { table: string; status: string }): Promise<T[]> => {
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
      result = await this.awsService.getAllQueryItems({ input });
      return (result || []) as T[];
    } catch (err) {
      const errMsg = `queryDeployableRecordsByStatus (table: ${table}):: could not get data for status: ${status}; error: ${err}`;
      throw setFailedAndCreateError(errMsg);
    }
  };

  queryRecordsByEnv = async <T>(params: { table: string; env: string }): Promise<T[]> => {
    const { table, env } = params;

    let result: Record<string, unknown>[];
    try {
      const input: QueryCommandInput = {
        TableName: table,
        IndexName: ENV_INDEX_NAME,
        KeyConditionExpression: 'env = :env',
        ExpressionAttributeValues: {
          ':env': env
        }
      };
      result = await this.awsService.getAllQueryItems({ input });
      return (result || []) as T[];
    } catch (err) {
      const errMsg = `queryRecordsByEnv (table: ${table}):: could not get data for env: ${env}; error: ${err}`;
      throw setFailedAndCreateError(errMsg);
    }
  };
}
