import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

// Mock @actions/core
const mockSetFailed = jest.fn();
jest.unstable_mockModule('@actions/core', () => ({
  info: jest.fn(),
  setFailed: mockSetFailed
}));

// Import after mocking
const { AwsService } = await import('../src/aws');

describe('AwsService', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockSend: jest.Mock<(command: any) => Promise<any>>;
  let awsService: InstanceType<typeof AwsService>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSend = jest.fn();
    awsService = new AwsService({ region: 'us-east-1' });
    jest
      .spyOn(awsService, 'ddbDocClient')
      .mockReturnValue({ send: mockSend } as unknown as DynamoDBDocumentClient);
  });

  describe('getAllQueryItems', () => {
    test('should follow LastEvaluatedKey across multiple pages', async () => {
      mockSend
        .mockResolvedValueOnce({ Items: [{ id: 'a' }], LastEvaluatedKey: { id: 'a' } })
        .mockResolvedValueOnce({ Items: [{ id: 'b' }], LastEvaluatedKey: { id: 'b' } })
        .mockResolvedValueOnce({ Items: [{ id: 'c' }] });

      const items = await awsService.getAllQueryItems({
        input: {
          TableName: 'deployedTable',
          IndexName: 'env-index',
          KeyConditionExpression: 'env = :env',
          ExpressionAttributeValues: { ':env': 'qa' }
        }
      });

      expect(items).toEqual([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
      expect(mockSend).toHaveBeenCalledTimes(3);
      expect(mockSend.mock.calls[2][0].input.ExclusiveStartKey).toEqual({ id: 'b' });
    });
  });

  describe('batchGetAll', () => {
    test('should retry UnprocessedKeys until all items are returned', async () => {
      mockSend
        .mockResolvedValueOnce({
          Responses: { deployedTable: [{ id: 'qa|app1' }] },
          UnprocessedKeys: { deployedTable: { Keys: [{ id: 'qa|app2' }] } }
        })
        .mockResolvedValueOnce({
          Responses: { deployedTable: [{ id: 'qa|app2' }] },
          UnprocessedKeys: {}
        });

      const items = await awsService.batchGetAll({
        tableName: 'deployedTable',
        keys: [{ id: 'qa|app1' }, { id: 'qa|app2' }],
        retryDelayMs: 0
      });

      expect(items).toEqual([{ id: 'qa|app1' }, { id: 'qa|app2' }]);
      expect(mockSend).toHaveBeenCalledTimes(2);
      expect(mockSend.mock.calls[1][0].input.RequestItems).toEqual({
        deployedTable: { Keys: [{ id: 'qa|app2' }] }
      });
    });

    test('should fail with a clear error when retries are exhausted', async () => {
      mockSend.mockResolvedValue({
        Responses: { deployedTable: [] },
        UnprocessedKeys: { deployedTable: { Keys: [{ id: 'qa|app1' }] } }
      });

      await expect(
        awsService.batchGetAll({
          tableName: 'deployedTable',
          keys: [{ id: 'qa|app1' }],
          retryDelayMs: 0,
          maxRetries: 2
        })
      ).rejects.toThrow('batchGetAll (table: deployedTable):: 1 key(s) still unprocessed');

      expect(mockSend).toHaveBeenCalledTimes(3);
    });

    test('should chunk keys into requests of at most 100', async () => {
      mockSend.mockImplementation(async (command) => ({
        Responses: { deployedTable: command.input.RequestItems.deployedTable.Keys }
      }));
      const keys = Array.from({ length: 150 }, (_, i) => ({ id: `qa|app${i}` }));

      const items = await awsService.batchGetAll({ tableName: 'deployedTable', keys });

      expect(items).toHaveLength(150);
      expect(mockSend).toHaveBeenCalledTimes(2);
      expect(mockSend.mock.calls[0][0].input.RequestItems.deployedTable.Keys).toHaveLength(100);
      expect(mockSend.mock.calls[1][0].input.RequestItems.deployedTable.Keys).toHaveLength(50);
    });

    test('should make no request for an empty key list', async () => {
      await expect(
        awsService.batchGetAll({ tableName: 'deployedTable', keys: [] })
      ).resolves.toEqual([]);
      expect(mockSend).not.toHaveBeenCalled();
    });

    test('should wrap DynamoDB errors', async () => {
      mockSend.mockRejectedValue(new Error('AccessDenied'));

      await expect(
        awsService.batchGetAll({ tableName: 'deployedTable', keys: [{ id: 'qa|app1' }] })
      ).rejects.toThrow('Could not batch get DynamoDb records');
    });
  });
});
