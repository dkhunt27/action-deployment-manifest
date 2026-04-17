import * as core from '@actions/core';
import {
  DeploymentManifestCommand,
  IfAddNewDeployableExists,
  type DeploymentManifestInputs
} from './types';

const isValidCommand = (command: string): command is DeploymentManifestCommand => {
  return Object.values(DeploymentManifestCommand).includes(command as DeploymentManifestCommand);
};

const isValidIfAddNewDeployableExists = (value: string): value is IfAddNewDeployableExists => {
  return Object.values(IfAddNewDeployableExists).includes(value as IfAddNewDeployableExists);
};

export const parseInputs = (): DeploymentManifestInputs => {
  const command = core.getInput('command', { required: true });

  if (!isValidCommand(command)) {
    throw new Error(
      `Invalid command input: ${command}; expected one of ${Object.values(DeploymentManifestCommand).join(', ')}`
    );
  }

  const ifAddNewDeployableExists =
    core.getInput('ifAddNewDeployableExists', { required: false }) ?? 'error';

  if (!isValidIfAddNewDeployableExists(ifAddNewDeployableExists)) {
    throw new Error(
      `Invalid ifAddNewDeployableExists input: ${ifAddNewDeployableExists}; expected one of ${Object.values(IfAddNewDeployableExists).join(', ')}`
    );
  }

  const version = core.getInput('version', { required: true });
  const actor = core.getInput('actor', { required: true });
  const env = core.getInput('env', { required: false });
  const deployedToProd =
    core.getInput('deployedToProd', {
      required: false
    }) === 'true';
  const deployables = core
    .getInput('deployables', { required: false })
    .split(',')
    .filter((d) => d.length > 0);

  const deployableTable = core.getInput('deployableTable', { required: true });
  const deployedTable = core.getInput('deployedTable', { required: true });
  const awsRegion = core.getInput('awsRegion', { required: false }) ?? 'us-east-1';

  return {
    command,
    ifAddNewDeployableExists,
    version,
    actor,
    deployables,
    env,
    deployedToProd,
    deployableTable,
    deployedTable,
    awsRegion
  };
};
