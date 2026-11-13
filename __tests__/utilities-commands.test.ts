import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { mock } from 'jest-mock-extended';
import type { AwsService } from '../src/aws';
import type { QueryUtilities } from '../src/utilities-query';
import {
  type DeployableRecordType,
  DeploymentStatus,
  IfAddNewDeployableExists
} from '../src/types';

// Mock @actions/core
const mockInfo = jest.fn();
jest.unstable_mockModule('@actions/core', () => ({
  info: mockInfo,
  setFailed: jest.fn()
}));

// Import after mocking
const { CommandUtilities } = await import('../src/utilities-commands');

describe('CommandUtilities', () => {
  let mockAwsService: jest.Mocked<AwsService>;
  let commandUtils: InstanceType<typeof CommandUtilities>;

  const record = (status: DeploymentStatus): DeployableRecordType => ({
    id: '2026.11.01-3|app1',
    version: '2026.11.01-3',
    deployable: 'app1',
    status,
    modifiedDate: '2026-11-01T00:00:00.000Z',
    modifiedBy: 'someone'
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockAwsService = mock<AwsService>();
    commandUtils = new CommandUtilities(mockAwsService, mock<QueryUtilities>(), {
      deployableTable: 'deployableTable',
      deployedTable: 'deployedTable',
      ifAddNewDeployableExists: IfAddNewDeployableExists.ERROR
    });
  });

  describe('updateDeployableVersionRecordToStatus', () => {
    const update = (
      status: DeploymentStatus,
      current: DeploymentStatus,
      onlyFrom?: DeploymentStatus[]
    ) =>
      commandUtils.updateDeployableVersionRecordToStatus({
        deployableTable: 'deployableTable',
        records: [record(current)],
        deployable: 'app1',
        version: '2026.11.01-3',
        actor: 'test-user',
        status,
        onlyFromStatuses: onlyFrom
      });

    test('should promote available to pending', async () => {
      await update(DeploymentStatus.PENDING, DeploymentStatus.AVAILABLE, [
        DeploymentStatus.AVAILABLE
      ]);

      expect(mockAwsService.update).toHaveBeenCalledTimes(1);
      expect(mockAwsService.update.mock.calls[0][0].input.ExpressionAttributeValues).toEqual(
        expect.objectContaining({ ':status': DeploymentStatus.PENDING })
      );
    });

    test.each([
      DeploymentStatus.PENDING,
      DeploymentStatus.PROD,
      DeploymentStatus.ROLLBACK,
      DeploymentStatus.DECOMMISSIONED,
      DeploymentStatus.REJECTED
    ])('should leave a %s record unchanged on non-prod deploy', async (current) => {
      await update(DeploymentStatus.PENDING, current, [DeploymentStatus.AVAILABLE]);

      expect(mockAwsService.update).not.toHaveBeenCalled();
    });

    test('should log why a prod record keeps its status', async () => {
      await update(DeploymentStatus.PENDING, DeploymentStatus.PROD, [DeploymentStatus.AVAILABLE]);

      expect(mockInfo).toHaveBeenCalledWith(
        'updateDeployableVersionRecordToStatus: deployable app1 / version 2026.11.01-3 keeps status prod (only available is changed to pending)'
      );
    });

    test('should set status from any current status when onlyFromStatuses is not given', async () => {
      await update(DeploymentStatus.PROD, DeploymentStatus.PENDING);

      expect(mockAwsService.update).toHaveBeenCalledTimes(1);
      expect(mockAwsService.update.mock.calls[0][0].input.ExpressionAttributeValues).toEqual(
        expect.objectContaining({ ':status': DeploymentStatus.PROD })
      );
    });
  });
});
