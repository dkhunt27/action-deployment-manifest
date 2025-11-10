import { DynamoDBClient, DynamoDBClientConfig } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  PutCommandInput,
  PutCommandOutput,
  QueryCommand,
  QueryCommandInput,
  QueryCommandOutput,
  TranslateConfig,
  UpdateCommand,
  UpdateCommandInput,
  UpdateCommandOutput
} from '@aws-sdk/lib-dynamodb';
import { marshallOptions, unmarshallOptions } from '@aws-sdk/util-dynamodb';
import _ from 'lodash';
import { setFailedAndCreateError } from './utilities.ts';

// const MAX_BATCH_WRITE_ITEMS = 25;
// const MAX_RETRY_COUNT = 5;
// const MAX_DELAY_TIME_IN_MS = 3000;
// const MAX_BATCH_WRITE_PARALLEL_EXECUTIONS = 20;

// type ProgressType = {
//   rows: number;
//   batchIndex: number;
//   capacity: number;
//   retries: number;
// };

// type TotalProgressType = {
//   rows: number;
//   batches: number;
//   capacity: number;
//   retries: number;
// };

export class AwsService {
  private awsDdbDocClient: DynamoDBDocumentClient | null = null;

  constructor(config?: DynamoDBClientConfig) {
    this.init({ config });
  }

  ddbDocClient = (): DynamoDBDocumentClient => {
    if (!this.awsDdbDocClient) {
      throw new Error(`ddbDocClient has not been initialized`);
    }
    return this.awsDdbDocClient;
  };

  // private delay = (ms: number) => {
  //   return new Promise((resolve) => setTimeout(resolve, ms));
  // };

  private buildTranslateConfig = (params?: {
    marshallOptions?: marshallOptions;
    unmarshallOptions?: unmarshallOptions;
  }): TranslateConfig => {
    const marshallOptions = _.get(params, 'marshallOptions', {
      // Whether to automatically convert empty strings, blobs, and sets to `null`.
      convertEmptyValues: false, // false, by default.
      // Whether to remove undefined values while marshalling.
      removeUndefinedValues: true, // false, by default.
      // Whether to convert typeof object to map attribute.
      convertClassInstanceToMap: false // false, by default.
    });

    const unmarshallOptions = _.get(params, 'unmarshallOptions', {
      // Whether to return numbers as a string instead of converting them to native JavaScript numbers.
      wrapNumbers: false // false, by default.
    });

    const translateConfig: TranslateConfig = {
      marshallOptions,
      unmarshallOptions
    };

    return translateConfig;
  };

  init = async (params?: {
    config?: DynamoDBClientConfig;
    marshallOptions?: marshallOptions;
    unmarshallOptions?: unmarshallOptions;
    disableXray?: boolean;
  }): Promise<void> => {
    const { config = {} } = params || {};
    config.region = config.region || 'us-east-1';

    const translateConfig = this.buildTranslateConfig({
      marshallOptions: params?.marshallOptions,
      unmarshallOptions: params?.unmarshallOptions
    });

    this.awsDdbDocClient = DynamoDBDocumentClient.from(new DynamoDBClient(config), translateConfig);
  };

  getAllQueryItems = async (params: {
    input: QueryCommandInput;
  }): Promise<Record<string, unknown>[]> => {
    const items: Record<string, unknown>[] = [];
    const { input } = params;
    const command = new QueryCommand(input);
    let data: QueryCommandOutput = await this.ddbDocClient().send(command);
    do {
      if (data.Items) {
        items.push(...data.Items);
      }
      if (data && data.LastEvaluatedKey) {
        input.ExclusiveStartKey = data.LastEvaluatedKey;
        const command = new QueryCommand(input);
        data = await this.ddbDocClient().send(command);
        if (!data.LastEvaluatedKey) {
          // if there is no LastEvaluatedKey, then add the last set of items to the array
          if (data.Items) {
            items.push(...data.Items);
          }
        }
      }
    } while (data.LastEvaluatedKey);

    return items;
  };

  put = async (params: {
    input: PutCommandInput;
    ignoreConditionExpressionFailedException?: boolean;
  }): Promise<PutCommandOutput> => {
    const { input } = params;

    const command = new PutCommand(input);

    try {
      return await this.ddbDocClient().send(command);
    } catch (err) {
      const errMsg = `Could not put DynamoDb record; input: ${JSON.stringify(input)}; error: ${err}`;
      throw setFailedAndCreateError(errMsg);
    }
  };

  update = async (params: { input: UpdateCommandInput }): Promise<UpdateCommandOutput> => {
    const { input } = params;

    const command = new UpdateCommand(input);

    try {
      return await this.ddbDocClient().send(command);
    } catch (err) {
      const errMsg = `Could not update DynamoDb record; input: ${JSON.stringify(input)}; error: ${err}`;
      throw setFailedAndCreateError(errMsg);
    }
  };

  // batchWrite = async (params: {
  //   input: BatchWriteCommandInput;
  // }): Promise<BatchWriteCommandOutput> => {
  //   const { input } = params;

  //   const command = new BatchWriteCommand(input);

  //   try {
  //     return await this.ddbDocClient().send(command);
  //   } catch (err) {
  //     const errMsg = `Could not batch write DynamoDb records; input: ${JSON.stringify(input)}; error: ${err}`;
  //     throw setFailedAndCreateError(errMsg);
  //   }
  // };

  // batchWritePutChunk = async (params: {
  //   chunk: object[];
  //   chunkIndex: number;
  //   tableName: string;
  //   retries?: number;
  // }): Promise<ProgressType> => {
  //   const { chunk, chunkIndex, tableName } = params;
  //   let retries = params.retries || 0;

  //   const input: BatchWriteCommandInput = {
  //     RequestItems: {
  //       [tableName]: chunk.map((item) => {
  //         return { PutRequest: { Item: item } };
  //       })
  //     },
  //     ReturnConsumedCapacity: 'TOTAL'
  //   };

  //   let retryItems: object[] = [];

  //   const progress = {
  //     batchIndex: chunkIndex,
  //     rows: chunk.length,
  //     capacity: 0,
  //     retries
  //   };

  //   try {
  //     const results = await this.batchWrite({ input });

  //     if (
  //       results.ConsumedCapacity &&
  //       results.ConsumedCapacity[0] &&
  //       results.ConsumedCapacity[0].CapacityUnits
  //     ) {
  //       progress.capacity = results.ConsumedCapacity[0].CapacityUnits;
  //     }

  //     /* Handle partial failures */
  //     if (
  //       results.UnprocessedItems &&
  //       results.UnprocessedItems[tableName] &&
  //       results.UnprocessedItems[tableName].length > 0
  //     ) {
  //       retryItems = results.UnprocessedItems[tableName];
  //     }
  //   } catch (err) {
  //     /* Only if all DynamoDB operations fail, or the API is throttled */
  //     // eslint-disable-next-line @typescript-eslint/no-explicit-any
  //     const errCode = (err as any).code as string;

  //     if (errCode == 'ProvisionedThroughputExceededException' || errCode == 'ThrottlingException') {
  //       retryItems = chunk;
  //     } else {
  //       throw err;
  //     }
  //   }

  //   if (retryItems.length !== 0) {
  //     retries++;

  //     if (retries > MAX_RETRY_COUNT) {
  //       throw new Error('batchWritePutChunk retries exhausted');
  //     }

  //     /* Delay Exponential with jitter before retrying these items */
  //     let delayTime = retries * retries * 50;
  //     let jitter = Math.ceil(Math.random() * 50);

  //     if (delayTime > MAX_DELAY_TIME_IN_MS) {
  //       /* Cap wait time and also increase jitter */
  //       delayTime = MAX_DELAY_TIME_IN_MS;
  //       jitter = jitter * 3;
  //     }

  //     const retryIn = delayTime + jitter;

  //     core.info(
  //       `batchWritePutChunk progress: ${JSON.stringify({
  //         ...progress,
  //         retryingIn: retryIn
  //       })}`
  //     );

  //     await this.delay(retryIn);

  //     const retryProgress = await this.batchWritePutChunk({
  //       chunk: retryItems,
  //       chunkIndex,
  //       tableName,
  //       retries
  //     });

  //     progress.capacity += retryProgress.capacity;
  //     progress.retries = retryProgress.retries;
  //   } else {
  //     core.info(`batchWritePutChunk progress: ${JSON.stringify(progress)}`);
  //   }

  //   return progress;
  // };

  // batchWritePutAll = async (params: {
  //   data: object[];
  //   tableName: string;
  //   maxBatchWriteItems?: number;
  //   maxBatchWriteParallelExecutions?: number;
  // }): Promise<TotalProgressType> => {
  //   const {
  //     data,
  //     tableName,
  //     maxBatchWriteItems = MAX_BATCH_WRITE_ITEMS,
  //     maxBatchWriteParallelExecutions = MAX_BATCH_WRITE_PARALLEL_EXECUTIONS
  //   } = params;

  //   // chunk data via batch write max items limit
  //   const chunkedData = _.chunk(data, maxBatchWriteItems);

  //   core.info(`looping through chunks: ${chunkedData.length}`);

  //   const chunkedIndexes = Object.keys(chunkedData);

  //   const progresses = mapLimit<string, ProgressType>(
  //     chunkedIndexes,
  //     maxBatchWriteParallelExecutions,
  //     // need to use asyncify to wrap the promise, otherwise it will not work/return results
  //     // https://github.com/caolan/async/issues/1685
  //     asyncify((index: string) => {
  //       const indexNum = Number(index);
  //       const chunk = chunkedData[indexNum];
  //       return this.batchWritePutChunk({
  //         chunk,
  //         chunkIndex: indexNum,
  //         tableName
  //       });
  //     })
  //   );

  //   return progresses.then((results) => {
  //     const totalProgress = results.reduce(
  //       (acc, item) => {
  //         return {
  //           batches: acc.batches + 1,
  //           rows: acc.rows + item.rows,
  //           capacity: acc.capacity + item.capacity,
  //           retries: acc.retries + item.retries
  //         };
  //       },
  //       { rows: 0, batches: 0, capacity: 0, retries: 0 }
  //     );

  //     core.info(`batchWritePutAll totalProgress: ${JSON.stringify(totalProgress)}`);

  //     return totalProgress;
  //   });
  // };
}
