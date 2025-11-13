/* eslint-disable jest/no-disabled-tests */
import type { DynamoDBClientConfig } from '@aws-sdk/client-dynamodb';
import type { CommandService } from '../src/commands.ts';
import { buildCommandService } from '../src/factory.ts';

// make sure to start localstack first `localstack start`
// and create the tables

describe.skip('CommandService e2e tests', () => {
  let service: CommandService;

  beforeEach(async () => {
    const deployableTable = 'deployable';
    const deployedTable = 'deployed';

    // mock using localstack
    const config: DynamoDBClientConfig = {
      endpoint: 'http://localhost.localstack.cloud:4566',
      region: 'us-east-1'
    };

    service = await buildCommandService({ deployableTable, deployedTable, config });
  });

  test('simulate v1 deployed to prod', async () => {
    // create deployable v1
    await expect(
      service.addNewDeployable({
        version: '1.0.0',
        deployables: ['app1', 'app2', 'app3'],
        actor: 'test-user'
      })
    ).resolves.toBeUndefined();

    // deployed to dev
    await expect(
      service.markDeployed({
        version: '1.0.0',
        env: 'dev',
        deployables: ['app1', 'app2', 'app3'],
        actor: 'test-user',
        deployedToProd: false
      })
    ).resolves.toBeUndefined();

    // deployed to qa
    await expect(
      service.markDeployed({
        version: '1.0.0',
        env: 'qa',
        deployables: ['app1', 'app2', 'app3'],
        actor: 'test-user',
        deployedToProd: false
      })
    ).resolves.toBeUndefined();

    // deployed to prod
    await expect(
      service.markDeployed({
        version: '1.0.0',
        env: 'prod',
        deployables: ['app1', 'app2', 'app3'],
        actor: 'test-user',
        deployedToProd: true
      })
    ).resolves.toBeUndefined();
  });

  test('simulate v1.1 deployed to prod, v1.2 deployed to qa, v1.3 deployed to dev', async () => {
    const params1 = {
      version: '1.1.0',
      deployables: ['app1', 'app2', 'app3'],
      actor: 'test-user'
    };

    // create deployables
    await expect(
      service.addNewDeployable({ ...params1, version: '1.1.0' })
    ).resolves.toBeUndefined();

    await expect(
      service.addNewDeployable({ ...params1, version: '1.2.0' })
    ).resolves.toBeUndefined();

    await expect(
      service.addNewDeployable({ ...params1, version: '1.3.0' })
    ).resolves.toBeUndefined();

    // deployed to 1.1 to prod
    let params2 = {
      version: '1.1.0',
      env: 'dev',
      deployables: ['app1', 'app2', 'app3'],
      actor: 'test-user',
      deployedToProd: false
    };

    await expect(service.markDeployed({ ...params2, env: 'dev' })).resolves.toBeUndefined();
    await expect(service.markDeployed({ ...params2, env: 'qa' })).resolves.toBeUndefined();
    await expect(
      service.markDeployed({ ...params2, env: 'prod', deployedToProd: true })
    ).resolves.toBeUndefined();

    // deployed to 1.2 to prod
    params2 = {
      version: '1.2.0',
      env: 'dev',
      deployables: ['app1', 'app2', 'app3'],
      actor: 'test-user',
      deployedToProd: false
    };

    await expect(service.markDeployed({ ...params2, env: 'dev' })).resolves.toBeUndefined();
    await expect(service.markDeployed({ ...params2, env: 'qa' })).resolves.toBeUndefined();

    // deployed to 1.3 to dev
    params2 = {
      version: '1.3.0',
      env: 'dev',
      deployables: ['app1', 'app2', 'app3'],
      actor: 'test-user',
      deployedToProd: false
    };

    await expect(service.markDeployed({ ...params2, env: 'dev' })).resolves.toBeUndefined();
  });

  test('simulate v1.2 deployed to prod, v1.3 deployed to qa, v1.4 deployed to dev', async () => {
    const params1 = {
      version: '1.4.0',
      deployables: ['app1', 'app2', 'app3'],
      actor: 'test-user'
    };

    // create deployables
    await expect(
      service.addNewDeployable({ ...params1, version: '1.4.0' })
    ).resolves.toBeUndefined();

    const params2 = {
      env: 'dev',
      deployables: ['app1', 'app2', 'app3'],
      actor: 'test-user',
      deployedToProd: false
    };

    // deployed to 1.2 to prod
    await expect(
      service.markDeployed({
        ...params2,
        version: '1.2.0',
        env: 'prod',
        deployedToProd: true
      })
    ).resolves.toBeUndefined();

    // deployed to 1.3 to qa
    await expect(
      service.markDeployed({
        ...params2,
        version: '1.3.0',
        env: 'qa',
        deployedToProd: false
      })
    ).resolves.toBeUndefined();
    // deployed to 1.4 to dev
    await expect(
      service.markDeployed({
        ...params2,
        version: '1.4.0',
        env: 'dev',
        deployedToProd: false
      })
    ).resolves.toBeUndefined();
  });
});
