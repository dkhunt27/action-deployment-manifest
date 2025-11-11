import type { ConfigService } from './config-service.ts';
import { type DeployableRecordType } from './types.ts';
import type { AssertUtilities } from './utilities-assert.ts';
import type { CommandUtilities } from './utilities-commands.ts';
import type { QueryUtilities } from './utilities-query.ts';
export declare class CommandService {
    private readonly assertUtils;
    private readonly commandUtils;
    private readonly queryUtils;
    private readonly config;
    constructor(assertUtils: AssertUtilities, commandUtils: CommandUtilities, queryUtils: QueryUtilities, configService: ConfigService);
    /**
     * handle new deployable (addNewDeployable, version, appList)
     *   - assert app/version does not exist in deployable
     *   - add app/version to deployable with status available
     */
    addNewDeployable: (params: {
        version: string;
        appList: string[];
        actor: string;
    }) => Promise<void>;
    /**
     * handle get deployable list. (getDeployableList, version, appList?)
     *   - assert app/version only has one record in deployable
     *   - if version=latest, return all records with status "prod" (restrict to appList if provided)
     *   - if version!=latest, return records with status not rejected that match version (restrict to appList if provided)
     */
    getDeployableList: (params: {
        version: string;
        appList?: string[];
    }) => Promise<DeployableRecordType[]>;
    /**
     * handle deployed (markDeployed, version, env, appList)
     *   - assert app/version exists in deployable exactly once
     *   - assert version/env exists in deployed no more than once
     *   - if env/app exists in deployed, update version
     *   - if env/app does not exist in deployed, add new record with version
     *   - if deployedToProd is true, update deployable
     *      - find app with status "rollback" and update to "decommissioned"
     *      - find app with status "prod" and update to "rollback"
     *      - find app/version set status to "prod"
     *   - if deployedToProd is not true, update deployable
     *      - find app/version set status to "pending"
     */
    markDeployed: (params: {
        version: string;
        env: string;
        appList: string[];
        actor: string;
        deployedToProd: boolean;
    }) => Promise<void>;
}
