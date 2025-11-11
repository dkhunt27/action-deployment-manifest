import { jest } from '@jest/globals';
import { mock } from 'jest-mock-extended';
import { ConfigService } from '../src/config-service.ts';
import { DeploymentStatus } from '../src/types.ts';
import type { setFailedAndCreateError } from '../src/utilities.ts';
import type { AssertUtilities } from '../src/utilities-assert.ts';
import type { CommandUtilities } from '../src/utilities-commands.ts';
import type { QueryUtilities } from '../src/utilities-query.ts';

// Mock @actions/core
const mockInfo = jest.fn();
const mockSetFailed = jest.fn();
jest.unstable_mockModule('@actions/core', () => ({
  info: mockInfo,
  setFailed: mockSetFailed
}));

// Mock utilities
const mockSetFailedAndCreateError: jest.Mocked<typeof setFailedAndCreateError> = jest.fn();
jest.unstable_mockModule('../src/utilities.ts', () => ({
  setFailedAndCreateError: mockSetFailedAndCreateError
}));

// Import after mocking
const { CommandService } = await import('../src/commands.ts');

describe('CommandService', () => {
  let commandService: CommandService;
  let mockAssertUtils: jest.Mocked<AssertUtilities>;
  let mockCommandUtils: jest.Mocked<CommandUtilities>;
  let mockQueryUtils: jest.Mocked<QueryUtilities>;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-01T11:22:27Z'));

    // Reset mock implementation
    mockSetFailedAndCreateError.mockImplementation((message: string) => {
      return new Error(message);
    });

    // just use the real services for these
    const configService = new ConfigService('deployableTable', 'deployedTable');

    // mock these services
    mockAssertUtils = mock<AssertUtilities>();
    mockCommandUtils = mock<CommandUtilities>();
    mockQueryUtils = mock<QueryUtilities>();

    // Create service instance
    commandService = new CommandService(
      mockAssertUtils,
      mockCommandUtils,
      mockQueryUtils,
      configService
    );

    // set happy path for mocks
    mockAssertUtils.assertAppVersionDoesNotExist.mockResolvedValue(undefined);
    mockAssertUtils.assertAppVersionExistsExactlyOnce.mockResolvedValue(undefined);
    mockAssertUtils.assertAppEnvExistsOnceAtMost.mockResolvedValue(undefined);
    mockQueryUtils.queryRecordsByVersion.mockResolvedValue([]);
    mockCommandUtils.putDeployableRecord.mockResolvedValue(undefined);
    mockCommandUtils.putDeployedRecord.mockResolvedValue(undefined);
    mockCommandUtils.updateDeployableVersionRecordToStatus.mockResolvedValue(undefined);
    mockCommandUtils.updateDeployableRollbackRecordToDecommissioned.mockResolvedValue(undefined);
    mockCommandUtils.updateDeployableProdRecordToRollback.mockResolvedValue(undefined);

    // Ensure core.info is reset to a simple mock
    mockInfo.mockImplementation(() => {});
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  describe('addNewDeployable', () => {
    let params: {
      version: string;
      appList: string[];
      actor: string;
    };
    beforeEach(() => {
      params = {
        version: '1.0.0',
        appList: ['app1', 'app2'],
        actor: 'test-user'
      };
    });

    test('should successfully add new deployable when no existing records', async () => {
      await commandService.addNewDeployable(params);

      expect(mockCommandUtils.putDeployableRecord).toHaveBeenCalledTimes(2);
      expect(mockCommandUtils.putDeployableRecord.mock.calls).toMatchSnapshot();
    });

    test('should throw error when appList is empty', async () => {
      params.appList = [];
      await expect(commandService.addNewDeployable(params)).rejects.toThrow(
        'appList cannot be empty'
      );

      expect(mockCommandUtils.putDeployableRecord).not.toHaveBeenCalled();
    });

    test('should throw error when assert throws', async () => {
      mockAssertUtils.assertAppVersionDoesNotExist.mockImplementation(() => {
        throw new Error('someError');
      });
      await expect(commandService.addNewDeployable(params)).rejects.toThrow('someError');

      expect(mockCommandUtils.putDeployableRecord).not.toHaveBeenCalled();
    });
  });

  describe('getDeployableList', () => {
    let params: {
      version: string;
      appList?: string[];
    };
    beforeEach(() => {
      const prodRecords = [
        { id: '1.0.0|app1', version: '1.0.0', app: 'app1', status: 'prod' },
        { id: '1.0.1|app2', version: '1.0.1', app: 'app2', status: 'prod' }
      ];
      const nonProdRecords = [
        { id: '1.0.2|app1', version: '1.0.2', app: 'app1', status: 'available' },
        { id: '1.0.2|app2', version: '1.0.2', app: 'app2', status: 'rejected' },
        { id: '1.0.2|app3', version: '1.0.2', app: 'app3', status: 'pending' },
        { id: '1.0.2|app4', version: '1.0.2', app: 'app4', status: 'available' },
        { id: '1.0.2|app5', version: '1.0.2', app: 'app5', status: 'available' }
      ];
      mockQueryUtils.queryRecordsByStatus.mockResolvedValue(prodRecords);
      mockQueryUtils.queryRecordsByVersion.mockResolvedValue(nonProdRecords);
    });
    test('should return all prod records when version is latest', async () => {
      params = { version: 'latest' };
      await expect(commandService.getDeployableList(params)).resolves.toMatchSnapshot();
    });

    test('should return app prod records when version is latest and appList provided', async () => {
      params = { version: 'latest', appList: ['app1'] };
      await expect(commandService.getDeployableList(params)).resolves.toMatchSnapshot();
    });

    test('should return non-rejected records for specific version', async () => {
      params = { version: '1.0.2' };
      await expect(commandService.getDeployableList(params)).resolves.toMatchSnapshot();
    });

    test('should filter by appList when provided', async () => {
      params = { version: '1.0.2', appList: ['app4', 'app5'] };
      await expect(commandService.getDeployableList(params)).resolves.toMatchSnapshot();
    });
  });

  describe('markDeployed', () => {
    let params: {
      version: string;
      env: string;
      appList: string[];
      actor: string;
      deployedToProd: boolean;
    };

    beforeEach(() => {
      params = {
        version: '1.0.0',
        env: 'staging',
        appList: ['app1', 'app2'],
        actor: 'test-user',
        deployedToProd: false
      };

      // Set up default mock implementations
      mockCommandUtils.getRelevantDeployableRecordsForMarkDeployed.mockResolvedValue([
        {
          id: '1.0.0|app1',
          version: '1.0.0',
          app: 'app1',
          status: DeploymentStatus.AVAILABLE,
          modifiedDate: new Date().toISOString(),
          modifiedBy: 'test'
        },
        {
          id: '1.0.0|app2',
          version: '1.0.0',
          app: 'app2',
          status: DeploymentStatus.AVAILABLE,
          modifiedDate: new Date().toISOString(),
          modifiedBy: 'test'
        }
      ]);
    });

    test('should successfully mark deployed to non-prod environment', async () => {
      await commandService.markDeployed(params);

      expect(mockInfo).toHaveBeenCalledWith(
        'Marking deployed to staging for version 1.0.0 (deployedToProd: false) restricting to apps: app1, app2'
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

    test('should handle single app deployment', async () => {
      params.appList = ['single-app'];

      await commandService.markDeployed(params);

      expect(mockCommandUtils.putDeployedRecord).toHaveBeenCalledTimes(1);
      expect(mockCommandUtils.putDeployedRecord).toHaveBeenCalledWith({
        env: 'staging',
        app: 'single-app',
        version: '1.0.0',
        actor: 'test-user'
      });
    });

    test('should throw error when assertAppVersionExistsExactlyOnce fails', async () => {
      mockAssertUtils.assertAppVersionExistsExactlyOnce.mockImplementation(() => {
        throw new Error('Version does not exist');
      });

      await expect(commandService.markDeployed(params)).rejects.toThrow('markDeployed error');

      expect(mockCommandUtils.putDeployedRecord).not.toHaveBeenCalled();
    });

    test('should throw error when assertAppEnvExistsOnceAtMost fails', async () => {
      mockAssertUtils.assertAppEnvExistsOnceAtMost.mockImplementation(() => {
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
      params.appList = ['app1', 'app2', 'app3'];

      mockCommandUtils.getRelevantDeployableRecordsForMarkDeployed.mockResolvedValue([
        {
          id: '0.9.0|app1',
          version: '0.9.0',
          app: 'app1',
          status: DeploymentStatus.PROD,
          modifiedDate: new Date().toISOString(),
          modifiedBy: 'test'
        }
      ]);

      mockCommandUtils.getRelevantDeployableRecordsForMarkDeployed.mockResolvedValue([
        {
          id: '0.8.0|app1',
          version: '0.8.0',
          app: 'app1',
          status: DeploymentStatus.ROLLBACK,
          modifiedDate: new Date().toISOString(),
          modifiedBy: 'test'
        }
      ]);

      mockCommandUtils.getRelevantDeployableRecordsForMarkDeployed.mockResolvedValue([
        {
          id: '1.0.0|app1',
          version: '1.0.0',
          app: 'app1',
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
