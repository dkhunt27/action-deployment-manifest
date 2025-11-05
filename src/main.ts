import * as core from '@actions/core'
import { setFailedAndCreateError } from './utilities.ts'

export const run = async (): Promise<void> => {
  try {
    core.info('Hello World')
  } catch (error) {
    const errMsg = `Failed to fetch git tags: ${error}`
    throw setFailedAndCreateError(errMsg)
  }
}
