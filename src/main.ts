import { init } from './aws.ts'
import { setFailedAndCreateError } from './utilities.ts'

export const run = async (): Promise<void> => {
  try {
    // inputs
    // version
    // env?
    // projectList?
    // markDeployed?
    // deployedToProd?
    // markRejected?
    // addNewDeployable?
    // getDeployableList?
    // actor
    // handle new deployable (addNewDeployable, version, projectList)
    // assert version/project does not exist in deployable
    // add version/project to deployable with status available
    // handle get deployable list. (getDeployableList, version, projectList?)
    // assert version/project only has one record in deployable
    // if version=latest, return all records with status "prod" (restrict to projectList if provided)
    // if version!=latest, return records with status not rejected that match version (restrict to projectList if provided)
    // handle rejected (markRejected, version, projectList?)
    // assert version/project only has one record in deployable
    // if projectList is empty, mark all projects for that version as rejected
    // if projectList is provided, mark only those projects as rejected
    // handle deployed (markDeployed, version, env, projectList)
    // assert version/env exists in deployable no more than once
    // if env/project exists in deployed, update version
    // if env/project does not exist in deployed, add new record with version
    // if deployedToProd is true, update deployable
    //    find project with status "rollback" and update to "decommissioned"
    //    find project with status "prod" and update to "rollback"
    //    find version/app set status to "prod"
    // if deployedToProd is not true, update deployable
    //    find version/app set status to "pending"
    init()

    if (
  } catch (error) {
    const errMsg = `Deployment manifest processing error: ${error}`
    throw setFailedAndCreateError(errMsg)
  }
}
