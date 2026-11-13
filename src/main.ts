import * as core from '@actions/core';
import { buildCommandService } from './factory';
import { parseInputs } from './inputs';
import {
  DeployableListItemType,
  DeploymentManifestCommand,
  DeploymentManifestInputs
} from './types';
import { setFailedAndCreateError } from './utilities';
import _ from 'lodash';

// with a fallback env the versions differ per deployable, so show each one and mark those taken from the fallback env
const buildMixedVersionPrettyString = (items: DeployableListItemType[]): string => {
  if (items.length === 0) {
    return '[]';
  }
  const lines = items.map(
    (d) => `${d.deployable}@${d.version}${d.fromEnv ? ` (from ${d.fromEnv})` : ''}`
  );
  return `[\n  ${lines.join(',\n  ')}\n]`;
};

export const execute = async (inputs: DeploymentManifestInputs): Promise<void> => {
  try {
    const commandService = await buildCommandService({
      deployableTable: inputs.deployableTable,
      deployedTable: inputs.deployedTable,
      ifAddNewDeployableExists: inputs.ifAddNewDeployableExists,
      awsRegion: inputs.awsRegion
    });

    switch (inputs.command) {
      case DeploymentManifestCommand.GET_DEPLOYABLE_LIST:
        {
          const fallbackEnv = inputs.fallbackEnv || undefined;

          const deployableList = await commandService.getDeployableList({
            version: inputs.version,
            fallbackEnv,
            deployables: inputs.deployables
          });

          // sort by version asc, deployable asc
          const sorted = _.orderBy(deployableList, ['version', 'deployable'], ['asc', 'asc']);

          // fromEnv is internal; keep deployablesFull the same shape (and key order) as before fallbackEnv existed
          const deployablesFullJson = JSON.stringify(
            sorted.map((d) => ({ version: d.version, deployable: d.deployable }))
          );

          const deployablesJson = JSON.stringify(
            sorted.map((d) => ({ deployable: d.deployable, version: d.version }))
          );

          const deployablesPrettyString = fallbackEnv
            ? buildMixedVersionPrettyString(sorted)
            : deployablesJson
                .replace(/\[\s*\{/, '[\n  {')
                .replace(/\}\s*\]/, '}\n]')
                .replace(/},\s*\{/g, '},\n  {');

          const hasDeployables = sorted.length > 0;

          core.setOutput('hasDeployables', hasDeployables);
          core.setOutput('deployables', deployablesJson);
          core.setOutput('deployablesFull', deployablesFullJson);
          core.setOutput('deployablesPrettyString', deployablesPrettyString);

          core.info(`hasDeployables: ${hasDeployables}`);
          core.info(`deployables: ${deployablesJson}`);
          core.info(`deployablesFull: ${deployablesFullJson}`);
          core.info(`deployablesPrettyString: ${deployablesPrettyString}`);
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
    const errMsg = `Deployment manifest execution error: ${error}`;
    throw setFailedAndCreateError(errMsg);
  }
};

export const run = async (): Promise<void> => {
  try {
    const inputs = parseInputs();

    await execute(inputs);
  } catch (error) {
    const errMsg = `Deployment manifest processing error: ${error}`;
    throw setFailedAndCreateError(errMsg);
  }
};
