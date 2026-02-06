import type { QueryUtilities } from './utilities-query';
export declare class AssertUtilities {
    private readonly queryUtils;
    constructor(queryUtils: QueryUtilities);
    assertDeployableVersionDoesNotExist: <T extends {
        deployable: string;
    }>(params: {
        version: string;
        deployables: string[];
        table: string;
    }) => Promise<void>;
    assertDeployableVersionExistsExactlyOnce: <T extends {
        deployable: string;
        version: string;
    }>(params: {
        version: string;
        deployables: string[];
        table: string;
    }) => Promise<void>;
    assertDeployableVersionRecordsExistsExactlyOnce: (params: {
        records: {
            deployable: string;
            version: string;
        }[];
        version: string;
        deployables: string[];
        table: string;
    }) => Promise<void>;
    assertDeployableVersionExistsOnceAtMost: <T extends {
        deployable: string;
    }>(params: {
        version: string;
        deployables: string[];
        table: string;
    }) => Promise<void>;
    assertDeployableEnvExistsOnceAtMost: <T extends {
        deployable: string;
    }>(params: {
        env: string;
        deployables: string[];
        table: string;
    }) => Promise<void>;
}
