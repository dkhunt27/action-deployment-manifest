import { addNewDeployable, getDeployableList } from '../src/commands.ts'
import { init } from '../src/aws.ts'

describe('commands manual test harness', () => {
  let origEnv: Record<string, string | undefined>
  beforeEach(() => {
    origEnv = process.env

    process.env = {
      AWS_PROFILE: 'legacy-non-prod',
      REGION: 'us-west-2'
    }

    init()
  })

  afterEach(() => {
    process.env = origEnv
  })

  describe.skip('addNewDeployable', () => {
    let params: {
      deployableTable: string
      version: string
      appList: string[]
      actor: string
    }
    beforeEach(() => {
      params = {
        deployableTable: 'dev-dhunt-pipelines-deployable',
        version: '1.0.0',
        appList: ['app1', 'app2'],
        actor: 'test-user'
      }
    })

    test('should successfully add new deployable when no existing records', async () => {
      // need to init
      await expect(addNewDeployable(params)).resolves.toBeUndefined()
    })
  })

  describe('getDeployableList', () => {
    let params: {
      deployableTable: string
      version: string
      appList?: string[]
    }
    beforeEach(() => {
      params = {
        deployableTable: 'dev-dhunt-pipelines-deployable',
        version: '1.0.0'
        // appList: ['app1', 'app2'],
      }
    })

    test('should successfully get deployable list', async () => {
      await expect(getDeployableList(params)).resolves.toEqual([
        {
          app: 'app1',
          createdBy: 'test-user',
          createdDate: '2025-11-06T21:36:16.852Z',
          id: '1.0.0|app1',
          status: 'available',
          version: '1.0.0'
        },
        {
          app: 'app2',
          createdBy: 'test-user',
          createdDate: '2025-11-06T21:36:16.852Z',
          id: '1.0.0|app2',
          status: 'available',
          version: '1.0.0'
        }
      ])
    })

    test('should successfully get restricted deployable list', async () => {
      params.appList = ['app1']

      await expect(getDeployableList(params)).resolves.toEqual([
        {
          app: 'app1',
          createdBy: 'test-user',
          createdDate: '2025-11-06T21:36:16.852Z',
          id: '1.0.0|app1',
          status: 'available',
          version: '1.0.0'
        }
      ])
    })
  })
})
