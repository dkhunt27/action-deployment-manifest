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
            deployables: inputs.deployables
          });

          const deployablesFullJson = JSON.stringify(deployableList);
          const deployablesJson = JSON.stringify(
            deployableList.map((d) => ({ deployable: d.deployable, version: d.version }))
          );
          const hasDeployables = deployableList.length > 0;

          core.setOutput('hasDeployables', hasDeployables);
          core.setOutput('deployables', deployablesJson);
          core.setOutput('deployablesFull', deployablesFullJson);

          core.info(`hasDeployables: ${hasDeployables}`);
          core.info(`deployables: ${deployablesJson}`);
          core.info(`deployablesFull: ${deployablesFullJson}`);
        }
        break;
      case DeploymentManifestCommand.ADD_NEW_DEPLOYABLE:
        if (!inputs.deployables || inputs.deployables.length === 0) {
          throw new Error(`deployables input is required for command: ${inputs.command}`);
        }
        await commandService.addNewDeployable({
          version: inputs.version,
          deployables: inputs.deployables,
          actor: inputs.actor
        });
        break;
      case DeploymentManifestCommand.MARK_DEPLOYED:
        if (!inputs.deployables || inputs.deployables.length === 0) {
          throw new Error(`deployables input is required for command: ${inputs.command}`);
        }
        if (!inputs.env) {
          throw new Error(`env input is required for command: ${inputs.command}`);
        }
        await commandService.markDeployed({
          version: inputs.version,
          deployables: inputs.deployables,
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
