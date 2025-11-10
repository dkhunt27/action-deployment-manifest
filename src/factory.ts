import type { DynamoDBClientConfig } from '@aws-sdk/client-dynamodb';
import { AwsService } from './aws.ts';
import { CommandService } from './commands.ts';
import { ConfigService } from './config-service.ts';
import { setFailedAndCreateError } from './utilities.ts';
import { AssertUtilities } from './utilities-assert.ts';
import { CommandUtilities } from './utilities-commands.ts';
import { QueryUtilities } from './utilities-query.ts';

export const buildCommandService = async (params: {
  deployableTable: string;
  deployedTable: string;
  region?: string;
  config?: DynamoDBClientConfig;
}): Promise<CommandService> => {
  const { deployableTable, deployedTable, config = { region: params.region } } = params;

  try {
    const configService = new ConfigService(deployableTable, deployedTable);
    const awsService = new AwsService(config);
    const queryUtils = new QueryUtilities(awsService);
    const commandUtils = new CommandUtilities(awsService, queryUtils, configService);
    const assertUtils = new AssertUtilities(queryUtils);

    const commandService = new CommandService(assertUtils, commandUtils, queryUtils, configService);

    return commandService;
  } catch (error) {
    const errMsg = `Deployment manifest processing error: ${error}`;
    throw setFailedAndCreateError(errMsg);
  }
};
