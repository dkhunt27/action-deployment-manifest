import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { mock } from 'jest-mock-extended';
import type { QueryUtilities } from '../src/utilities-query';

// Mock @actions/core
jest.unstable_mockModule('@actions/core', () => ({
  setFailed: jest.fn()
}));

// Import after mocking
const { AssertUtilities } = await import('../src/utilities-assert');

describe('AssertUtilities', () => {
  let mockQueryUtils: jest.Mocked<QueryUtilities>;
  let assertUtils: InstanceType<typeof AssertUtilities>;

  beforeEach(() => {
    mockQueryUtils = mock<QueryUtilities>();
    assertUtils = new AssertUtilities(mockQueryUtils);
  });

  describe('assertDeployableVersionExistsExactlyOnce', () => {
    const params = { table: 'deployableTable', version: '1.0.0', deployables: ['app1'] };

    test('should reject when no records exist for the version', async () => {
      mockQueryUtils.queryRecordsByVersion.mockResolvedValue([]);

      await expect(assertUtils.assertDeployableVersionExistsExactlyOnce(params)).rejects.toThrow(
        'no record(s) found for version: 1.0.0'
      );
    });

    test('should reject when the deployable is missing at the version', async () => {
      mockQueryUtils.queryRecordsByVersion.mockResolvedValue([
        { deployable: 'app2', version: '1.0.0' }
      ]);

      await expect(assertUtils.assertDeployableVersionExistsExactlyOnce(params)).rejects.toThrow(
        'no record found for version: 1.0.0 and deployable: app1'
      );
    });

    test('should resolve when the deployable exists exactly once', async () => {
      mockQueryUtils.queryRecordsByVersion.mockResolvedValue([
        { deployable: 'app1', version: '1.0.0' }
      ]);

      await expect(
        assertUtils.assertDeployableVersionExistsExactlyOnce(params)
      ).resolves.toBeUndefined();
    });
  });

  describe('assertDeployableEnvExistsOnceAtMost', () => {
    test('should reject when the deployable has multiple records in the env', async () => {
      mockQueryUtils.queryRecordsByEnv.mockResolvedValue([
        { deployable: 'app1' },
        { deployable: 'app1' }
      ]);

      await expect(
        assertUtils.assertDeployableEnvExistsOnceAtMost({
          table: 'deployedTable',
          env: 'qa',
          deployables: ['app1']
        })
      ).rejects.toThrow('multiple records (2) found for env: qa and deployable: app1');
    });
  });
});
