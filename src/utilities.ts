import * as core from '@actions/core';

export const setFailedAndCreateError = (message: string): Error => {
  core.setFailed(message);
  return new Error(message);
};

export const buildDeployableKey = (params: { deployable: string; version: string }) => {
  const { deployable, version } = params;
  return `${version}|${deployable}`;
};

export const buildDeployedKey = (params: { deployable: string; env: string }) => {
  const { deployable, env } = params;
  return `${env}|${deployable}`;
};
