import * as core from '@actions/core';
import { DeploymentManifestCommand, type DeploymentManifestInputs } from './types.ts';

const isValidCommand = (command: string): command is DeploymentManifestCommand => {
  return Object.values(DeploymentManifestCommand).includes(command as DeploymentManifestCommand);
};

export const parseInputs = (): DeploymentManifestInputs => {
  const command = core.getInput('command', { required: true });
  if (!isValidCommand(command)) {
    throw new Error(
      `Invalid command input: ${command}; expected one of ${Object.values(DeploymentManifestCommand).join(', ')}`
    );
  }
  const version = core.getInput('version', { required: true });
  const actor = core.getInput('actor', { required: true });
  const env = core.getInput('env', { required: false });
  const deployedToProd =
    core.getInput('deployedToProd', {
      required: false
    }) === 'true';
  const appList = core
    .getInput('appList', { required: false })
    .split(',')
    .filter((app) => app.length > 0);

  const deployableTable = core.getInput('deployableTable', { required: true });
  const deployedTable = core.getInput('deployedTable', { required: true });
  const awsRegion = core.getInput('awsRegion', { required: false }) ?? 'us-east-1';

  return {
    command,
    version,
    actor,
    appList,
    env,
    deployedToProd,
    deployableTable,
    deployedTable,
    awsRegion
  };
};
