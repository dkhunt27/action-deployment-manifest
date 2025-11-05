import * as core from '@actions/core'

export const setFailedAndCreateError = (message: string): Error => {
  core.setFailed(message)
  return new Error(message)
}
