import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import { mock } from 'jest-mock-extended';
import {
  DeployableRecordType,
  DeployedRecordType,
  DeploymentStatus,
  IfAddNewDeployableExists
} from '../src/types';
import type { setFailedAndCreateError } from '../src/utilities';
import type { AssertUtilities } from '../src/utilities-assert';
import type { CommandUtilities } from '../src/utilities-commands';
import type { QueryUtilities } from '../src/utilities-query';

// Mock @actions/core
const mockInfo = jest.fn();
const mockWarning = jest.fn();
const mockSetFailed = jest.fn();
jest.unstable_mockModule('@actions/core', () => ({
  info: mockInfo,
  warning: mockWarning,
  setFailed: mockSetFailed
}));

// Mock utilities
const mockSetFailedAndCreateError: jest.Mocked<typeof setFailedAndCreateError> = jest.fn();
jest.unstable_mockModule('../src/utilities', () => ({
  setFailedAndCreateError: mockSetFailedAndCreateError
}));

// Import after mocking
const { CommandService } = await import('../src/commands');

describe('CommandService', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let commandService: any;
  let mockAssertUtils: jest.Mocked<AssertUtilities>;
  let mockCommandUtils: jest.Mocked<CommandUtilities>;
  let mockQueryUtils: jest.Mocked<QueryUtilities>;

  const createCommandService = (ifExists: IfAddNewDeployableExists) =>
    new CommandService(mockAssertUtils, mockCommandUtils, mockQueryUtils, {
      deployableTable: 'deployableTable',
      deployedTable: 'deployedTable',
      ifAddNewDeployableExists: ifExists
    });

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-01T11:22:27Z'));

    // Reset mock implementation
    mockSetFailedAndCreateError.mockImplementation((message: string) => {
      return new Error(message);
    });

    // mock these services
    mockAssertUtils = mock<AssertUtilities>();
    mockCommandUtils = mock<CommandUtilities>();
    mockQueryUtils = mock<QueryUtilities>();

    // Create service instance

    // default to error for ifExists
    commandService = createCommandService(IfAddNewDeployableExists.ERROR);

    // set happy path for mocks
    mockAssertUtils.assertDeployableVersionDoesNotExist.mockResolvedValue(undefined);
    mockAssertUtils.assertDeployableVersionExistsExactlyOnce.mockResolvedValue(undefined);
    mockAssertUtils.assertDeployableEnvExistsOnceAtMost.mockResolvedValue(undefined);
    mockCommandUtils.putDeployableRecord.mockResolvedValue(undefined);
    mockCommandUtils.putDeployedRecord.mockResolvedValue(undefined);
    mockCommandUtils.updateDeployableVersionRecordToStatus.mockResolvedValue(undefined);
    mockCommandUtils.updateDeployableRollbackRecordToDecommissioned.mockResolvedValue(undefined);
    mockCommandUtils.updateDeployableProdRecordToRollback.mockResolvedValue(undefined);
    mockCommandUtils.checkIfDeployableVersionExists.mockResolvedValue(false);

    // Ensure core.info is reset to a simple mock
    mockInfo.mockImplementation(() => {});
    mockWarning.mockImplementation(() => {});
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  describe('addNewDeployable', () => {
    let params: {
      version: string;
      deployables: string[];
      actor: string;
    };
    beforeEach(() => {
      params = {
        version: '1.0.0',
        deployables: ['app1', 'app2'],
        actor: 'test-user'
      };
    });

    test('should throw error when deployables is empty', async () => {
      params.deployables = [];
      await expect(commandService.addNewDeployable(params)).rejects.toThrow(
        'deployables cannot be empty'
      );

      expect(mockCommandUtils.putDeployableRecord).not.toHaveBeenCalled();
    });

    test('should throw error when check throws', async () => {
      mockCommandUtils.checkIfDeployableVersionExists.mockImplementation(() => {
        throw new Error('someError');
      });
      await expect(commandService.addNewDeployable(params)).rejects.toThrow('someError');

      expect(mockCommandUtils.putDeployableRecord).not.toHaveBeenCalled();
    });

    test('should successfully add new deployable when no existing records', async () => {
      mockCommandUtils.checkIfDeployableVersionExists.mockResolvedValue(false);
      commandService = createCommandService(IfAddNewDeployableExists.ERROR);
      await expect(commandService.addNewDeployable(params)).resolves.toBeUndefined();

      expect(mockCommandUtils.putDeployableRecord).toHaveBeenCalledTimes(2);
      expect(mockCommandUtils.putDeployableRecord.mock.calls).toMatchSnapshot();
    });

    test('should throw error when check returns true and ifExists is error', async () => {
      mockCommandUtils.checkIfDeployableVersionExists.mockResolvedValue(true);
      commandService = createCommandService(IfAddNewDeployableExists.ERROR);

      await expect(commandService.addNewDeployable(params)).rejects.toThrow(
        `addNewDeployable error: deployable ${params.deployables[0]} with version ${params.version} already exists in table ${commandService['config'].deployableTable}`
      );

      expect(mockCommandUtils.putDeployableRecord).not.toHaveBeenCalled();
    });

    test('should do nothing when check returns true and ifExists is ignore', async () => {
      mockCommandUtils.checkIfDeployableVersionExists.mockResolvedValue(true);
      commandService = createCommandService(IfAddNewDeployableExists.IGNORE);

      await expect(commandService.addNewDeployable(params)).resolves.toBeUndefined();

      expect(mockCommandUtils.putDeployableRecord).not.toHaveBeenCalled();
    });

    test('should overwrite when check returns true and ifExists is overwrite', async () => {
      mockCommandUtils.checkIfDeployableVersionExists.mockResolvedValue(true);
      commandService = createCommandService(IfAddNewDeployableExists.OVERWRITE);

      await expect(commandService.addNewDeployable(params)).resolves.toBeUndefined();

      expect(mockCommandUtils.putDeployableRecord).toHaveBeenCalledTimes(2);
    });
  });

  describe('getDeployableList', () => {
    let params: {
      version: string;
      deployables?: string[];
    };
    beforeEach(() => {
      const deployedRecords: DeployedRecordType[] = [
        { id: 'env1|app1', version: '1.0.0', deployable: 'app1', env: 'env1' },
        { id: 'env1|app2', version: '1.0.1', deployable: 'app2', env: 'env1' }
      ] as DeployedRecordType[];

      const deployableRecords: DeployableRecordType[] = [
        {
          id: '1.0.2|app1',
          version: '1.0.2',
          deployable: 'app1',
          status: DeploymentStatus.AVAILABLE
        },
        {
          id: '1.0.2|app2',
          version: '1.0.2',
          deployable: 'app2',
          status: DeploymentStatus.REJECTED
        },
        {
          id: '1.0.2|app3',
          version: '1.0.2',
          deployable: 'app3',
          status: DeploymentStatus.PENDING
        },
        {
          id: '1.0.2|app4',
          version: '1.0.2',
          deployable: 'app4',
          status: DeploymentStatus.AVAILABLE
        },
        {
          id: '1.0.2|app5',
          version: '1.0.2',
          deployable: 'app5',
          status: DeploymentStatus.AVAILABLE
        }
      ] as DeployableRecordType[];

      mockQueryUtils.queryRecordsByEnv.mockResolvedValue(deployedRecords);
      mockQueryUtils.queryRecordsByVersion.mockResolvedValue(deployableRecords);
    });
    test('should return all env1 records when version is env1', async () => {
      params = { version: 'env1' };
      await expect(commandService.getDeployableList(params)).resolves.toMatchInlineSnapshot(`
        [
          {
            "deployable": "app1",
            "version": "1.0.0",
          },
          {
            "deployable": "app2",
            "version": "1.0.1",
          },
        ]
      `);
    });

    test('should return deployable prod records when version is latest and deployables provided', async () => {
      params = { version: 'env1', deployables: ['app1'] };
      await expect(commandService.getDeployableList(params)).resolves.toMatchInlineSnapshot(`
        [
          {
            "deployable": "app1",
            "version": "1.0.0",
          },
        ]
      `);
    });

    test('should return non-rejected records for specific version', async () => {
      params = { version: '1.0.2' };
      await expect(commandService.getDeployableList(params)).resolves.toMatchInlineSnapshot(`
        [
          {
            "deployable": "app1",
            "version": "1.0.2",
          },
          {
            "deployable": "app3",
            "version": "1.0.2",
          },
          {
            "deployable": "app4",
            "version": "1.0.2",
          },
          {
            "deployable": "app5",
            "version": "1.0.2",
          },
        ]
      `);
    });

    test('should filter by deployables when provided', async () => {
      params = { version: '1.0.2', deployables: ['app4', 'app5'] };
      await expect(commandService.getDeployableList(params)).resolves.toMatchInlineSnapshot(`
        [
          {
            "deployable": "app4",
            "version": "1.0.2",
          },
          {
            "deployable": "app5",
            "version": "1.0.2",
          },
        ]
      `);
    });

    test('should behave exactly as before when fallbackEnv is empty', async () => {
      params = { version: '1.0.2', deployables: ['app4', 'app5'] };
      const withoutBase = await commandService.getDeployableList(params);
      const withEmptyBase = await commandService.getDeployableList({ ...params, fallbackEnv: '' });

      expect(withEmptyBase).toEqual(withoutBase);
      expect(mockAssertUtils.assertDeployableVersionRecordsExistsExactlyOnce).toHaveBeenCalledTimes(
        2
      );
      expect(mockQueryUtils.getDeployedRecordsByEnvAndDeployables).not.toHaveBeenCalled();
    });
  });

  describe('getDeployableList with fallbackEnv', () => {
    const version = '2026.11.13-1';
    const fallbackEnv = 'qa';

    beforeEach(() => {
      const versionRecords = [
        { id: `${version}|app1`, version, deployable: 'app1', status: DeploymentStatus.AVAILABLE },
        { id: `${version}|app2`, version, deployable: 'app2', status: DeploymentStatus.REJECTED },
        { id: `${version}|app3`, version, deployable: 'app3', status: DeploymentStatus.PENDING }
      ] as DeployableRecordType[];

      const fallbackRecords = [
        { id: 'qa|app1', env: 'qa', deployable: 'app1', version: '2026.11.01-3' },
        { id: 'qa|app2', env: 'qa', deployable: 'app2', version: '2026.11.01-3' },
        { id: 'qa|app4', env: 'qa', deployable: 'app4', version: '2026.10.30-1' }
      ] as DeployedRecordType[];

      mockQueryUtils.queryRecordsByVersion.mockResolvedValue(versionRecords);
      mockQueryUtils.queryRecordsByEnv.mockResolvedValue(fallbackRecords);
      mockQueryUtils.getDeployedRecordsByEnvAndDeployables.mockImplementation(
        async ({ deployables }) =>
          fallbackRecords.filter((r) => deployables.includes(r.deployable)) as never
      );
    });

    describe('deployables empty', () => {
      test('should union version records with fallback env records, version winning', async () => {
        const result = await commandService.getDeployableList({ version, fallbackEnv });

        expect(result).toEqual([
          { version, deployable: 'app1' },
          { version, deployable: 'app3' },
          // app2 is rejected at version, so it falls back to what qa runs
          { version: '2026.11.01-3', deployable: 'app2', fromEnv: 'qa' },
          { version: '2026.10.30-1', deployable: 'app4', fromEnv: 'qa' }
        ]);
        expect(mockQueryUtils.queryRecordsByEnv).toHaveBeenCalledWith({
          table: 'deployedTable',
          env: 'qa'
        });
        expect(mockQueryUtils.getDeployedRecordsByEnvAndDeployables).not.toHaveBeenCalled();
      });

      test('should log a summary of version vs fallback env counts', async () => {
        await commandService.getDeployableList({ version, fallbackEnv });

        expect(mockInfo).toHaveBeenCalledWith(
          `getDeployableList summary: 2 from version ${version}, 2 from fallback env qa`
        );
      });

      test('should return only version records and warn when fallback env has no rows', async () => {
        mockQueryUtils.queryRecordsByEnv.mockResolvedValue([]);

        const result = await commandService.getDeployableList({ version, fallbackEnv });

        expect(result).toEqual([
          { version, deployable: 'app1' },
          { version, deployable: 'app3' }
        ]);
        expect(mockWarning).toHaveBeenCalledWith(
          expect.stringContaining('fallback env "qa" has no deployed records')
        );
      });

      test('should return fallback env records when nothing exists at version', async () => {
        mockQueryUtils.queryRecordsByVersion.mockResolvedValue([]);

        const result = await commandService.getDeployableList({ version, fallbackEnv });

        expect(result).toEqual([
          { version: '2026.11.01-3', deployable: 'app1', fromEnv: 'qa' },
          { version: '2026.11.01-3', deployable: 'app2', fromEnv: 'qa' },
          { version: '2026.10.30-1', deployable: 'app4', fromEnv: 'qa' }
        ]);
      });
    });

    describe('deployables given', () => {
      test('should take each name from version, else fallback env, else skip and log', async () => {
        const result = await commandService.getDeployableList({
          version,
          fallbackEnv,
          deployables: ['app1', 'app4', 'app9', 'app2']
        });

        expect(result).toEqual([
          { version, deployable: 'app1' },
          { version: '2026.10.30-1', deployable: 'app4', fromEnv: 'qa' },
          { version: '2026.11.01-3', deployable: 'app2', fromEnv: 'qa' }
        ]);
        expect(mockQueryUtils.getDeployedRecordsByEnvAndDeployables).toHaveBeenCalledWith({
          table: 'deployedTable',
          env: 'qa',
          deployables: ['app4', 'app9', 'app2']
        });
        expect(mockWarning).toHaveBeenCalledWith(
          `app9: nothing at ${version} and nothing deployed to qa`
        );
        expect(mockInfo).toHaveBeenCalledWith(
          `getDeployableList summary: 1 from version ${version}, 2 from fallback env qa, 1 skipped`
        );
      });

      test('should not require every name to exist at version', async () => {
        await commandService.getDeployableList({
          version,
          fallbackEnv,
          deployables: ['app4']
        });

        expect(
          mockAssertUtils.assertDeployableVersionRecordsExistsExactlyOnce
        ).not.toHaveBeenCalled();
      });

      test('should not look up fallback env when every name exists at version', async () => {
        const result = await commandService.getDeployableList({
          version,
          fallbackEnv,
          deployables: ['app1', 'app3']
        });

        expect(result).toEqual([
          { version, deployable: 'app1' },
          { version, deployable: 'app3' }
        ]);
        expect(mockQueryUtils.getDeployedRecordsByEnvAndDeployables).not.toHaveBeenCalled();
        expect(mockQueryUtils.queryRecordsByEnv).not.toHaveBeenCalled();
      });

      test('should look up duplicate names once', async () => {
        await commandService.getDeployableList({
          version,
          fallbackEnv,
          deployables: ['app4', 'app4']
        });

        expect(mockQueryUtils.getDeployedRecordsByEnvAndDeployables).toHaveBeenCalledWith(
          expect.objectContaining({ deployables: ['app4'] })
        );
      });

      test('should skip every name and warn when fallback env has none of them', async () => {
        mockQueryUtils.getDeployedRecordsByEnvAndDeployables.mockResolvedValue([]);

        const result = await commandService.getDeployableList({
          version,
          fallbackEnv,
          deployables: ['app4', 'app9']
        });

        expect(result).toEqual([]);
        expect(mockWarning).toHaveBeenCalledWith(
          `app4: nothing at ${version} and nothing deployed to qa`
        );
        expect(mockWarning).toHaveBeenCalledWith(
          `app9: nothing at ${version} and nothing deployed to qa`
        );
      });
    });

    test.each(['2026.11.01-3', '1.0.0', 'qa.v2'])(
      'should fail fast when fallbackEnv looks like a version (%s)',
      async (badEnv) => {
        await expect(
          commandService.getDeployableList({ version, fallbackEnv: badEnv })
        ).rejects.toThrow(`fallbackEnv must be an env name (e.g. "qa"), not a version: ${badEnv}`);

        expect(mockQueryUtils.queryRecordsByVersion).not.toHaveBeenCalled();
        expect(mockQueryUtils.queryRecordsByEnv).not.toHaveBeenCalled();
      }
    );
  });

  describe('markDeployed', () => {
    let params: {
      version: string;
      env: string;
      deployables: string[];
      actor: string;
      deployedToProd: boolean;
    };

    beforeEach(() => {
      params = {
        version: '1.0.0',
        env: 'staging',
        deployables: ['app1', 'app2'],
        actor: 'test-user',
        deployedToProd: false
      };

      // Set up default mock implementations
      mockCommandUtils.getRelevantDeployableRecordsForMarkDeployed.mockResolvedValue([
        {
          id: '1.0.0|app1',
          version: '1.0.0',
          deployable: 'app1',
          status: DeploymentStatus.AVAILABLE,
          modifiedDate: new Date().toISOString(),
          modifiedBy: 'test'
        },
        {
          id: '1.0.0|app2',
          version: '1.0.0',
          deployable: 'app2',
          status: DeploymentStatus.AVAILABLE,
          modifiedDate: new Date().toISOString(),
          modifiedBy: 'test'
        }
      ]);
    });

    test('should successfully mark deployed to non-prod environment', async () => {
      await commandService.markDeployed(params);

      expect(mockInfo).toHaveBeenCalledWith(
        'Marking deployed to staging for version 1.0.0 (deployedToProd: false) restricting to deployables: app1, app2'
      );

      expect(mockCommandUtils.putDeployedRecord.mock.calls).toMatchSnapshot();
      expect(mockCommandUtils.updateDeployableVersionRecordToStatus.mock.calls).toMatchSnapshot();
      expect(
        mockCommandUtils.updateDeployableRollbackRecordToDecommissioned
      ).not.toHaveBeenCalled();
      expect(mockCommandUtils.updateDeployableProdRecordToRollback).not.toHaveBeenCalled();
    });

    test('should successfully mark deployed to prod environment', async () => {
      params.env = 'prod';
      params.deployedToProd = true;

      await commandService.markDeployed(params);

      expect(mockCommandUtils.putDeployedRecord.mock.calls).toMatchSnapshot();
      expect(mockCommandUtils.updateDeployableVersionRecordToStatus.mock.calls).toMatchSnapshot();
      expect(
        mockCommandUtils.updateDeployableRollbackRecordToDecommissioned.mock.calls
      ).toMatchSnapshot();
      expect(mockCommandUtils.updateDeployableProdRecordToRollback.mock.calls).toMatchSnapshot();
    });

    test('should handle single deployable deployment', async () => {
      params.deployables = ['appA'];

      await commandService.markDeployed(params);

      expect(mockCommandUtils.putDeployedRecord).toHaveBeenCalledTimes(1);
      expect(mockCommandUtils.putDeployedRecord).toHaveBeenCalledWith({
        env: 'staging',
        deployable: 'appA',
        version: '1.0.0',
        actor: 'test-user'
      });
    });

    test('should throw error when assertDeployableVersionExistsExactlyOnce fails', async () => {
      mockAssertUtils.assertDeployableVersionExistsExactlyOnce.mockImplementation(() => {
        throw new Error('Version does not exist');
      });

      await expect(commandService.markDeployed(params)).rejects.toThrow('markDeployed error');

      expect(mockCommandUtils.putDeployedRecord).not.toHaveBeenCalled();
    });

    test('should throw error when assertDeployableEnvExistsOnceAtMost fails', async () => {
      mockAssertUtils.assertDeployableEnvExistsOnceAtMost.mockImplementation(() => {
        throw new Error('Multiple env records exist');
      });

      await expect(commandService.markDeployed(params)).rejects.toThrow('markDeployed error');

      expect(mockCommandUtils.putDeployedRecord).not.toHaveBeenCalled();
    });

    test('should throw error when putDeployedRecord fails', async () => {
      mockCommandUtils.putDeployedRecord.mockRejectedValue(new Error('Database error'));

      await expect(commandService.markDeployed(params)).rejects.toThrow('markDeployed error');
    });

    test('should throw error when updateDeployableVersionRecordToStatus fails', async () => {
      mockCommandUtils.updateDeployableVersionRecordToStatus.mockRejectedValue(
        new Error('Update failed')
      );

      await expect(commandService.markDeployed(params)).rejects.toThrow('markDeployed error');
    });

    test('should process all apps in prod deployment even with multiple status transitions', async () => {
      params.deployedToProd = true;
      params.env = 'prod';
      params.deployables = ['app1', 'app2', 'app3'];

      mockCommandUtils.getRelevantDeployableRecordsForMarkDeployed.mockResolvedValue([
        {
          id: '0.9.0|app1',
          version: '0.9.0',
          deployable: 'app1',
          status: DeploymentStatus.PROD,
          modifiedDate: new Date().toISOString(),
          modifiedBy: 'test'
        }
      ]);

      mockCommandUtils.getRelevantDeployableRecordsForMarkDeployed.mockResolvedValue([
        {
          id: '0.8.0|app1',
          version: '0.8.0',
          deployable: 'app1',
          status: DeploymentStatus.ROLLBACK,
          modifiedDate: new Date().toISOString(),
          modifiedBy: 'test'
        }
      ]);

      mockCommandUtils.getRelevantDeployableRecordsForMarkDeployed.mockResolvedValue([
        {
          id: '1.0.0|app1',
          version: '1.0.0',
          deployable: 'app1',
          status: DeploymentStatus.AVAILABLE,
          modifiedDate: new Date().toISOString(),
          modifiedBy: 'test'
        }
      ]);

      await commandService.markDeployed(params);

      expect(mockCommandUtils.updateDeployableRollbackRecordToDecommissioned).toHaveBeenCalledTimes(
        3
      );
      expect(mockCommandUtils.updateDeployableProdRecordToRollback).toHaveBeenCalledTimes(3);
      expect(mockCommandUtils.updateDeployableVersionRecordToStatus).toHaveBeenCalledTimes(3);
    });

    test('should use correct deployment status based on deployedToProd flag', async () => {
      // Test non-prod deployment
      params.deployedToProd = false;
      await commandService.markDeployed(params);

      expect(mockCommandUtils.updateDeployableVersionRecordToStatus).toHaveBeenCalledWith(
        expect.objectContaining({
          status: DeploymentStatus.PENDING
        })
      );

      jest.clearAllMocks();

      // Test prod deployment
      params.deployedToProd = true;
      await commandService.markDeployed(params);

      expect(mockCommandUtils.updateDeployableVersionRecordToStatus).toHaveBeenCalledWith(
        expect.objectContaining({
          status: DeploymentStatus.PROD
        })
      );
    });
  });
});
