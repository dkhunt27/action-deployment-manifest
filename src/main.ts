import * as core from '@actions/core';
import { buildCommandService } from './factory.ts';
import { parseInputs } from './inputs.ts';
import { DeploymentManifestCommand } from './types.ts';
import { setFailedAndCreateError } from './utilities.ts';

export const run = async (): Promise<void> => {
  try {
    const inputs = parseInputs();

    const commandService = await buildCommandService({
      deployableTable: inputs.deployableTable,
      deployedTable: inputs.deployedTable,
      awsRegion: inputs.awsRegion
    });

    switch (inputs.command) {
      case DeploymentManifestCommand.GET_DEPLOYABLE_LIST:
        {
          const deployableList = await commandService.getDeployableList({
            version: inputs.version,
            appList: inputs.appList
          });

          const deployableAppList = deployableList.map((record) => record.app);
          core.setOutput('deployableAppList', deployableAppList.join(','));
          core.setOutput('deployableList', JSON.stringify(deployableList));

          core.info(`deployableAppList: ${deployableAppList.join(', ')}`);
          core.info(`deployableList: ${JSON.stringify(deployableList)}`);
        }
        break;
      case DeploymentManifestCommand.ADD_NEW_DEPLOYABLE:
        if (!inputs.appList || inputs.appList.length === 0) {
          throw new Error(`appList input is required for command: ${inputs.command}`);
        }
        await commandService.addNewDeployable({
          version: inputs.version,
          appList: inputs.appList,
          actor: inputs.actor
        });
        break;
      case DeploymentManifestCommand.MARK_DEPLOYED:
        if (!inputs.appList || inputs.appList.length === 0) {
          throw new Error(`appList input is required for command: ${inputs.command}`);
        }
        if (!inputs.env) {
          throw new Error(`env input is required for command: ${inputs.command}`);
        }
        await commandService.markDeployed({
          version: inputs.version,
          appList: inputs.appList,
          actor: inputs.actor,
          env: inputs.env,
          deployedToProd: inputs.deployedToProd ?? false
        });
        break;
      default:
        throw new Error(`Unhandled command: ${inputs.command}`);
    }
  } catch (error) {
    const errMsg = `Deployment manifest processing error: ${error}`;
    throw setFailedAndCreateError(errMsg);
  }
};
