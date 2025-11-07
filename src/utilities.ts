import * as core from '@actions/core';

export const setFailedAndCreateError = (message: string): Error => {
  core.setFailed(message);
  return new Error(message);
};

export const buildDeployableKey = (params: { app: string; version: string }) => {
  const { app, version } = params;
  return `${version}|${app}`;
};

export const buildDeployedKey = (params: { app: string; env: string }) => {
  const { app, env } = params;
  return `${env}|${app}`;
};
