import type { QueryUtilities } from './utilities-query.ts';
export declare class AssertUtilities {
    private readonly queryUtils;
    constructor(queryUtils: QueryUtilities);
    assertAppVersionDoesNotExist: <T extends {
        app: string;
    }>(params: {
        version: string;
        appList: string[];
        table: string;
    }) => Promise<void>;
    assertAppVersionExistsExactlyOnce: <T extends {
        app: string;
    }>(params: {
        version: string;
        appList: string[];
        table: string;
    }) => Promise<void>;
    assertAppVersionRecordsExistsExactlyOnce: <T extends {
        app: string;
    }>(params: {
        records: T[];
        version: string;
        appList: string[];
        table: string;
    }) => Promise<void>;
    assertAppVersionExistsOnceAtMost: <T extends {
        app: string;
    }>(params: {
        version: string;
        appList: string[];
        table: string;
    }) => Promise<void>;
    assertAppEnvExistsOnceAtMost: <T extends {
        app: string;
    }>(params: {
        env: string;
        appList: string[];
        table: string;
    }) => Promise<void>;
}
