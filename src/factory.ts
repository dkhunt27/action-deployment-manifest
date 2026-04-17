import type { DynamoDBClientConfig } from '@aws-sdk/client-dynamodb';
import { AwsService } from './aws';
import { CommandService } from './commands';
import { setFailedAndCreateError } from './utilities';
import { AssertUtilities } from './utilities-assert';
import { CommandUtilities } from './utilities-commands';
import { QueryUtilities } from './utilities-query';
import { ConfigurationType, IfAddNewDeployableExists } from './types';

export const buildCommandService = async (params: {
  deployableTable: string;
  deployedTable: string;
  ifAddNewDeployableExists: IfAddNewDeployableExists;
  awsRegion?: string;
  ddbConfig?: DynamoDBClientConfig;
}): Promise<CommandService> => {
  const {
    deployableTable,
    deployedTable,
    ifAddNewDeployableExists,
    ddbConfig = { region: params.awsRegion }
  } = params;

  try {
    const config: ConfigurationType = { deployableTable, deployedTable, ifAddNewDeployableExists };
    const awsService = new AwsService(ddbConfig);
    const queryUtils = new QueryUtilities(awsService);
    const commandUtils = new CommandUtilities(awsService, queryUtils, config);
    const assertUtils = new AssertUtilities(queryUtils);

    const commandService = new CommandService(assertUtils, commandUtils, queryUtils, config);

    return commandService;
  } catch (error) {
    const errMsg = `Deployment manifest processing error: ${error}`;
    throw setFailedAndCreateError(errMsg);
  }
};
