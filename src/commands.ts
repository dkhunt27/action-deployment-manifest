import * as core from '@actions/core'
import { setFailedAndCreateError } from './utilities.ts'
import { QueryCommandInput } from '@aws-sdk/lib-dynamodb'
import { batchWriteAll, getAllQueryItems } from './aws.ts'
import { DeployableRecordType } from './types.ts'

const VERSION_INDEX_NAME = 'version-index'
const STATUS_INDEX_NAME = 'status-index'

const queryDeployableRecordsByVersion = async (params: {
  deployableTable: string
  version: string
}): Promise<DeployableRecordType[]> => {
  const { deployableTable, version } = params

  let result: Record<string, unknown>[]
  try {
    const input: QueryCommandInput = {
      TableName: deployableTable,
      IndexName: VERSION_INDEX_NAME,
      KeyConditionExpression: 'version = :version',
      ExpressionAttributeValues: {
        ':version': version
      }
    }
    result = await getAllQueryItems({ input })
    return (result || []) as DeployableRecordType[]
  } catch (err) {
    const errMsg = `queryVersionRecords (table: ${deployableTable}):: could not get data for version: ${version} and appList: ${appList}; error: ${err}`
    throw setFailedAndCreateError(errMsg)
  }
}

const queryDeployableRecordsByStatus = async (params: {
  deployableTable: string
  status: string
}): Promise<DeployableRecordType[]> => {
  const { deployableTable, status } = params

  let result: Record<string, unknown>[]
  try {
    const input: QueryCommandInput = {
      TableName: deployableTable,
      IndexName: STATUS_INDEX_NAME,
      KeyConditionExpression: 'status = :status',
      ExpressionAttributeValues: {
        ':status': status
      }
    }
    result = await getAllQueryItems({ input })
    return (result || []) as DeployableRecordType[]
  } catch (err) {
    const errMsg = `queryStatusRecords (table: ${deployableTable}):: could not get data for status: ${status}; error: ${err}`
    throw setFailedAndCreateError(errMsg)
  }
}

const assertVersionAppDoesNotExist = async (params: {
  deployableTable: string
  version: string
  appList: string[]
}): Promise<void> => {
  const { deployableTable, version, appList } = params

  const result = await queryDeployableRecordsByVersion({
    deployableTable,
    version
  })

  // IN is not support in DynamoDb queries, so we have to check appList manually
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existingApps: any[] = []
  if (result) {
    for (const record of result) {
      if (appList.includes(record.app)) {
        existingApps.push(record.app)
      }
    }
  }
  if (existingApps.length > 0) {
    const errMsg = `addNewDeployable (table: ${deployableTable}):: record(s) already exist for version: ${version} and apps: ${existingApps.join(
      ', '
    )}`
    throw setFailedAndCreateError(errMsg)
  }
}

// handle new deployable (addNewDeployable, version, appList)
// assert version/app does not exist in deployable
// add version/app to deployable with status available
export const addNewDeployable = async (params: {
  deployableTable: string
  version: string
  appList: string[]
  actor: string
}): Promise<void> => {
  const { deployableTable, version, appList, actor } = params
  core.info(
    `Adding new deployable version ${version} for apps: ${appList.join(', ')} by actor ${actor}`
  )

  // assert version/app does not exist in deployable
  await assertVersionAppDoesNotExist({ deployableTable, version, appList })

  // add version/app to deployable with status available

  try {
    const data = appList.map((item) => {
      return {
        id: `${version}|${item}`,
        version,
        app: item,
        status: 'available',
        createdDate: new Date().toISOString(),
        createdBy: actor
      }
    })
    await batchWriteAll({ tableName: deployableTable, data })
  } catch (err) {
    const errMsg = `addNewDeployable (table: ${deployableTable}):: could not put data for version: ${version} and appList: ${appList}; error: ${err}`
    throw setFailedAndCreateError(errMsg)
  }
}

// handle get deployable list. (getDeployableList, version, appList?)
// assert version/app only has one record in deployable
// if version=latest, return all records with status "prod" (restrict to appList if provided)
// if version!=latest, return records with status not rejected that match version (restrict to appList if provided)
export const getDeployableList = async (params: {
  deployableTable: string
  version: string
  appList?: string[]
}): Promise<DeployableRecordType[]> => {
  const { version, appList = [] } = params
  try {
    let logMsg = `Getting deployable list for version ${version}`
    logMsg +=
      appList.length > 0
        ? ` restricting to apps: ${appList.join(', ')}`
        : ' (all apps)'
    core.info(logMsg)

    let records: DeployableRecordType[] = []
    if (version === 'latest') {
      // if version=latest, return all records with status "prod"
      records = await queryDeployableRecordsByStatus({
        deployableTable: params.deployableTable,
        status: 'prod'
      })
    } else {
      // if version!=latest, return records with status not rejected that match version
      const all = await queryDeployableRecordsByVersion({
        deployableTable: params.deployableTable,
        version
      })

      records = all.filter((item) => item.status !== 'rejected')
    }

    const filtered =
      appList.length > 0
        ? records.filter((item) => appList.includes(item.app))
        : records

    return filtered
  } catch (error) {
    const errMsg = `getDeployableList error: ${error}`
    throw setFailedAndCreateError(errMsg)
  }
}

export const markRejected = async (params: {
  version: string
  actor: string
  appList?: string[]
}): Promise<void> => {
  const { version, actor, appList = [] } = params
  try {
    let logMsg = `Marking deployable as rejected for version ${version} by actor ${actor}`
    logMsg +=
      appList.length > 0
        ? ` restricting to apps: ${appList.join(', ')}`
        : ' (all apps)'
    core.info(logMsg)

    // handle rejected (markRejected, version, appList?)
    // assert version/app only has one record in deployable
    // if appList is empty, mark all apps for that version as rejected
    // if appList is provided, mark only those apps as rejected
  } catch (error) {
    const errMsg = `markRejected error: ${error}`
    throw setFailedAndCreateError(errMsg)
  }
}

export const markDeployed = async (params: {
  version: string
  env: string
  appList: string[]
}): Promise<void> => {
  const { version, appList } = params
  try {
    let logMsg = `Marking deployable as rejected for version ${version}`
    logMsg +=
      appList.length > 0
        ? ` restricting to apps: ${appList.join(', ')}`
        : ' (all apps)'
    core.info(logMsg)

    // handle deployed (markDeployed, version, env, appList)
    // assert version/env exists in deployable no more than once
    // if env/app exists in deployed, update version
    // if env/app does not exist in deployed, add new record with version
    // if deployedToProd is true, update deployable
    //    find app with status "rollback" and update to "decommissioned"
    //    find app with status "prod" and update to "rollback"
    //    find version/app set status to "prod"
    // if deployedToProd is not true, update deployable
    //    find version/app set status to "pending"
  } catch (error) {
    const errMsg = `addNewDeployable error: ${error}`
    throw setFailedAndCreateError(errMsg)
  }
}
