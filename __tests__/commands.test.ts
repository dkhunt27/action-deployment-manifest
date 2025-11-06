import { jest } from '@jest/globals'

// Mock all dependencies before importing the module under test
jest.unstable_mockModule('@actions/core', () => ({
  info: jest.fn(),
  setFailed: jest.fn()
}))

jest.unstable_mockModule('../src/utilities.ts', () => ({
  setFailedAndCreateError: jest.fn()
}))

jest.unstable_mockModule('../src/aws.ts', () => ({
  getAllQueryItems: jest.fn(),
  batchWriteAll: jest.fn()
}))

// Import the mocked modules
const core = await import('@actions/core')
const utilities = await import('../src/utilities.ts')
const aws = await import('../src/aws.ts')

// Import the module under test after mocking dependencies
const { addNewDeployable, getDeployableList, markRejected, markDeployed } =
  await import('../src/commands.ts')

// Get the mocked functions
const mockCore = core as jest.Mocked<typeof core>
const mockSetFailedAndCreateError =
  utilities.setFailedAndCreateError as jest.MockedFunction<
    typeof utilities.setFailedAndCreateError
  >
const mockGetAllQueryItems = aws.getAllQueryItems as jest.MockedFunction<
  typeof aws.getAllQueryItems
>
const mockBatchWriteAll = aws.batchWriteAll as jest.MockedFunction<
  typeof aws.batchWriteAll
>

describe('commands', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks()

    // Reset mock implementations to default
    mockSetFailedAndCreateError.mockImplementation((message: string) => {
      return new Error(message)
    })

    // Ensure core.info is reset to a simple mock
    mockCore.info.mockImplementation(() => {})
  })

  describe('addNewDeployable', () => {
    const defaultParams = {
      deployableTable: 'test-table',
      version: '1.0.0',
      appList: ['app1', 'app2'],
      actor: 'test-user'
    }

    test('should successfully add new deployable when no existing records', async () => {
      mockGetAllQueryItems.mockResolvedValue([])
      mockBatchWriteAll.mockResolvedValue({
        rows: 2,
        batches: 1,
        capacity: 10,
        retries: 0
      })

      await addNewDeployable(defaultParams)

      expect(mockCore.info).toHaveBeenCalledWith(
        'Adding new deployable version 1.0.0 for apps: app1, app2 by actor test-user'
      )

      expect(mockGetAllQueryItems).toHaveBeenCalledWith({
        input: {
          TableName: 'test-table',
          IndexName: 'version-app-index',
          KeyConditionExpression: 'version = :version AND app IN (:appList)',
          ExpressionAttributeValues: {
            ':version': '1.0.0',
            ':appList': ['app1', 'app2']
          }
        }
      })

      expect(mockBatchWriteAll).toHaveBeenCalledWith({
        tableName: 'test-table',
        data: [
          {
            version: '1.0.0',
            app: 'app1',
            status: 'available',
            createdDate: expect.any(String),
            createdBy: 'test-user'
          },
          {
            version: '1.0.0',
            app: 'app2',
            status: 'available',
            createdDate: expect.any(String),
            createdBy: 'test-user'
          }
        ]
      })
    })

    test('should throw error when records already exist', async () => {
      const existingRecords = [{ version: '1.0.0', app: 'app1' }]
      mockGetAllQueryItems.mockResolvedValue(existingRecords)

      await expect(addNewDeployable(defaultParams)).rejects.toThrow()

      expect(mockSetFailedAndCreateError).toHaveBeenCalledWith(
        'addNewDeployable (table: test-table):: records already exist for version: 1.0.0 and appList: app1,app2'
      )
      expect(mockBatchWriteAll).not.toHaveBeenCalled()
    })

    test('should throw error when query fails', async () => {
      const queryError = new Error('Database connection failed')
      mockGetAllQueryItems.mockRejectedValue(queryError)

      await expect(addNewDeployable(defaultParams)).rejects.toThrow()

      expect(mockSetFailedAndCreateError).toHaveBeenCalledWith(
        'addNewDeployable (table: test-table):: could not get data for version: 1.0.0 and appList: app1,app2; error: Error: Database connection failed'
      )
    })

    test('should throw error when batch write fails', async () => {
      mockGetAllQueryItems.mockResolvedValue([])
      const writeError = new Error('Write operation failed')
      mockBatchWriteAll.mockRejectedValue(writeError)

      await expect(addNewDeployable(defaultParams)).rejects.toThrow()

      expect(mockSetFailedAndCreateError).toHaveBeenCalledWith(
        'addNewDeployable (table: test-table):: could not put data for version: 1.0.0 and appList: app1,app2; error: Error: Write operation failed'
      )
    })

    test('should handle single app in list', async () => {
      const singleappParams = {
        ...defaultParams,
        appList: ['single-app']
      }
      mockGetAllQueryItems.mockResolvedValue([])
      mockBatchWriteAll.mockResolvedValue({
        rows: 1,
        batches: 1,
        capacity: 5,
        retries: 0
      })

      await addNewDeployable(singleappParams)

      expect(mockCore.info).toHaveBeenCalledWith(
        'Adding new deployable version 1.0.0 for apps: single-app by actor test-user'
      )

      expect(mockBatchWriteAll).toHaveBeenCalledWith({
        tableName: 'test-table',
        data: [
          {
            version: '1.0.0',
            app: 'single-app',
            status: 'available',
            createdDate: expect.any(String),
            createdBy: 'test-user'
          }
        ]
      })
    })

    test('should set correct createdDate format', async () => {
      mockGetAllQueryItems.mockResolvedValue([])
      mockBatchWriteAll.mockResolvedValue({
        rows: 2,
        batches: 1,
        capacity: 10,
        retries: 0
      })

      const dateSpy = jest
        .spyOn(Date.prototype, 'toISOString')
        .mockReturnValue('2023-01-01T00:00:00.000Z')

      await addNewDeployable(defaultParams)

      expect(mockBatchWriteAll).toHaveBeenCalledWith({
        tableName: 'test-table',
        data: expect.arrayContaining([
          expect.objectContaining({
            createdDate: '2023-01-01T00:00:00.000Z'
          })
        ])
      })

      dateSpy.mockRestore()
    })
  })

  describe('getDeployableList', () => {
    test('should log correct message for all apps', async () => {
      const params = { version: '1.0.0' }

      await getDeployableList(params)

      expect(mockCore.info).toHaveBeenCalledWith(
        'Getting deployable list for version 1.0.0 (all apps)'
      )
    })

    test('should log correct message with app list', async () => {
      const params = {
        version: '1.0.0',
        appList: ['app1', 'app2']
      }

      await getDeployableList(params)

      expect(mockCore.info).toHaveBeenCalledWith(
        'Getting deployable list for version 1.0.0 restricting to apps: app1, app2'
      )
    })

    test('should handle empty app list', async () => {
      const params = {
        version: '1.0.0',
        appList: []
      }

      await getDeployableList(params)

      expect(mockCore.info).toHaveBeenCalledWith(
        'Getting deployable list for version 1.0.0 (all apps)'
      )
    })

    test('should throw error when operation fails', async () => {
      const params = { version: '1.0.0' }

      // Mock an error in the try block by throwing in the core.info call
      mockCore.info.mockImplementationOnce(() => {
        throw new Error('Unexpected error')
      })

      await expect(getDeployableList(params)).rejects.toThrow()

      expect(mockSetFailedAndCreateError).toHaveBeenCalledWith(
        'getDeployableList error: Error: Unexpected error'
      )
    })
  })

  describe('markRejected', () => {
    test('should log correct message for all apps', async () => {
      const params = {
        version: '1.0.0',
        actor: 'test-user'
      }

      await markRejected(params)

      expect(mockCore.info).toHaveBeenCalledWith(
        'Marking deployable as rejected for version 1.0.0 by actor test-user (all apps)'
      )
    })

    test('should log correct message with app list', async () => {
      const params = {
        version: '1.0.0',
        actor: 'test-user',
        appList: ['app1', 'app2']
      }

      await markRejected(params)

      expect(mockCore.info).toHaveBeenCalledWith(
        'Marking deployable as rejected for version 1.0.0 by actor test-user restricting to apps: app1, app2'
      )
    })

    test('should handle empty app list', async () => {
      const params = {
        version: '1.0.0',
        actor: 'test-user',
        appList: []
      }

      await markRejected(params)

      expect(mockCore.info).toHaveBeenCalledWith(
        'Marking deployable as rejected for version 1.0.0 by actor test-user (all apps)'
      )
    })

    test('should throw error when operation fails', async () => {
      const params = {
        version: '1.0.0',
        actor: 'test-user'
      }

      // Mock an error in the try block
      mockCore.info.mockImplementationOnce(() => {
        throw new Error('Unexpected error')
      })

      await expect(markRejected(params)).rejects.toThrow()

      expect(mockSetFailedAndCreateError).toHaveBeenCalledWith(
        'markRejected error: Error: Unexpected error'
      )
    })
  })

  describe('markDeployed', () => {
    test('should log correct message with app list', async () => {
      const params = {
        version: '1.0.0',
        env: 'staging',
        appList: ['app1', 'app2']
      }

      await markDeployed(params)

      expect(mockCore.info).toHaveBeenCalledWith(
        'Marking deployable as rejected for version 1.0.0 restricting to apps: app1, app2'
      )
    })

    test('should handle empty app list', async () => {
      const params = {
        version: '1.0.0',
        env: 'staging',
        appList: []
      }

      await markDeployed(params)

      expect(mockCore.info).toHaveBeenCalledWith(
        'Marking deployable as rejected for version 1.0.0 (all apps)'
      )
    })

    test('should throw error when operation fails', async () => {
      const params = {
        version: '1.0.0',
        env: 'staging',
        appList: ['app1']
      }

      // Mock an error in the try block
      mockCore.info.mockImplementationOnce(() => {
        throw new Error('Unexpected error')
      })

      await expect(markDeployed(params)).rejects.toThrow()

      expect(mockSetFailedAndCreateError).toHaveBeenCalledWith(
        'addNewDeployable error: Error: Unexpected error'
      )
    })

    test('should handle single app', async () => {
      const params = {
        version: '1.0.0',
        env: 'production',
        appList: ['single-app']
      }

      await markDeployed(params)

      expect(mockCore.info).toHaveBeenCalledWith(
        'Marking deployable as rejected for version 1.0.0 restricting to apps: single-app'
      )
    })
  })
})
