export declare const setFailedAndCreateError: (message: string) => Error;
export declare const buildDeployableKey: (params: {
    app: string;
    version: string;
}) => string;
export declare const buildDeployedKey: (params: {
    app: string;
    env: string;
}) => string;
