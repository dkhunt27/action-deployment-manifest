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

          const deployableAppListString = deployableList.map((record) => record.app).join(',');
          const deployableAppList = deployableList.map((record) => record.app);
          const deployableListJson = JSON.stringify(deployableList);
          const hasDeployables = deployableList.length > 0;

          core.setOutput('deployableAppList', deployableAppList);
          core.setOutput('deployableAppListString', deployableAppListString);
          core.setOutput('deployableList', deployableListJson);
          core.setOutput('hasDeployables', hasDeployables);

          core.info(`deployableAppList: ${deployableAppList}`);
          core.info(`deployableAppListString: ${deployableAppListString}`);
          core.info(`deployableList: ${deployableListJson}`);
          core.info(`hasDeployables: ${hasDeployables}`);
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
