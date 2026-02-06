import type { DynamoDBClientConfig } from '@aws-sdk/client-dynamodb';
import { AwsService } from './aws';
import { CommandService } from './commands';
import { ConfigService } from './config-service';
import { setFailedAndCreateError } from './utilities';
import { AssertUtilities } from './utilities-assert';
import { CommandUtilities } from './utilities-commands';
import { QueryUtilities } from './utilities-query';

export const buildCommandService = async (params: {
  deployableTable: string;
  deployedTable: string;
  awsRegion?: string;
  config?: DynamoDBClientConfig;
}): Promise<CommandService> => {
  const { deployableTable, deployedTable, config = { region: params.awsRegion } } = params;

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
