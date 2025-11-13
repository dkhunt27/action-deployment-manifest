export declare const setFailedAndCreateError: (message: string) => Error;
export declare const buildDeployableKey: (params: {
    deployable: string;
    version: string;
}) => string;
export declare const buildDeployedKey: (params: {
    deployable: string;
    env: string;
}) => string;
