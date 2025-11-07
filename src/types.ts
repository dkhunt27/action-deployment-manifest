export enum DeploymentStatus {
  AVAILABLE = 'available',
  DECOMMISSIONED = 'decommissioned',
  PENDING = 'pending',
  PROD = 'prod',
  REJECTED = 'rejected',
  ROLLBACK = 'rollback'
}

export type DeployableRecordType = {
  id: string;
  version: string;
  app: string;
  status: DeploymentStatus;
  createdDate: string;
  createdBy: string;
};

export type DeployedRecordType = {
  id: string;
  env: string;
  app: string;
  version: string;
  deployedDate: string;
  deployedBy: string;
};
