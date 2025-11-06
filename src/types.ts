export type DeployableRecordType = {
  id: string
  version: string
  app: string
  status: 'available' | 'prod' | 'rejected'
  createdDate: string
  createdBy: string
}
