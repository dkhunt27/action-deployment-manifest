import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { mock } from 'jest-mock-extended';
import type { AwsService } from '../src/aws';

// Mock @actions/core
jest.unstable_mockModule('@actions/core', () => ({
  setFailed: jest.fn()
}));

// Import after mocking
const { QueryUtilities } = await import('../src/utilities-query');

describe('QueryUtilities', () => {
  let mockAwsService: jest.Mocked<AwsService>;
  let queryUtils: InstanceType<typeof QueryUtilities>;

  beforeEach(() => {
    mockAwsService = mock<AwsService>();
    queryUtils = new QueryUtilities(mockAwsService);
  });

  describe('queryRecordsByEnv', () => {
    test('should query the env-index GSI', async () => {
      mockAwsService.getAllQueryItems.mockResolvedValue([{ id: 'qa|app1' }]);

      await expect(
        queryUtils.queryRecordsByEnv({ table: 'deployedTable', env: 'qa' })
      ).resolves.toEqual([{ id: 'qa|app1' }]);
      expect(mockAwsService.getAllQueryItems).toHaveBeenCalledWith({
        input: expect.objectContaining({ TableName: 'deployedTable', IndexName: 'env-index' })
      });
    });
  });

  describe('getDeployedRecordsByEnvAndDeployables', () => {
    test('should batch get by "<env>|<deployable>" keys', async () => {
      mockAwsService.batchGetAll.mockResolvedValue([{ id: 'qa|app1' }]);

      const result = await queryUtils.getDeployedRecordsByEnvAndDeployables({
        table: 'deployedTable',
        env: 'qa',
        deployables: ['app1', 'app2']
      });

      expect(result).toEqual([{ id: 'qa|app1' }]);
      expect(mockAwsService.batchGetAll).toHaveBeenCalledWith({
        tableName: 'deployedTable',
        keys: [{ id: 'qa|app1' }, { id: 'qa|app2' }]
      });
    });

    test('should wrap errors with the env and deployables', async () => {
      mockAwsService.batchGetAll.mockRejectedValue(new Error('boom'));

      await expect(
        queryUtils.getDeployedRecordsByEnvAndDeployables({
          table: 'deployedTable',
          env: 'qa',
          deployables: ['app1']
        })
      ).rejects.toThrow('could not get data for env: qa, deployables: app1; error: Error: boom');
    });
  });
});
