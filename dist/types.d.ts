export declare enum DeploymentStatus {
    AVAILABLE = "available",
    DECOMMISSIONED = "decommissioned",
    PENDING = "pending",
    PROD = "prod",
    REJECTED = "rejected",
    ROLLBACK = "rollback"
}
export declare enum DeploymentManifestCommand {
    ADD_NEW_DEPLOYABLE = "addNewDeployable",
    GET_DEPLOYABLE_LIST = "getDeployableList",
    MARK_DEPLOYED = "markDeployed"
}
export type DeployableRecordType = {
    id: string;
    version: string;
    app: string;
    status: DeploymentStatus;
    modifiedDate: string;
    modifiedBy: string;
};
export type DeployedRecordType = {
    id: string;
    env: string;
    app: string;
    version: string;
    deployedDate: string;
    deployedBy: string;
};
export type ConfigurationType = {
    deployableTable: string;
    deployedTable: string;
};
export type DeploymentManifestInputs = {
    command: DeploymentManifestCommand;
    version: string;
    actor: string;
    appList?: string[];
    env?: string;
    deployedToProd?: boolean;
    deployableTable: string;
    deployedTable: string;
    awsRegion: string;
};
