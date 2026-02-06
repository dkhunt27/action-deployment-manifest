import type { ConfigService } from './config-service';
import type { AssertUtilities } from './utilities-assert';
import type { CommandUtilities } from './utilities-commands';
import type { QueryUtilities } from './utilities-query';
export declare class CommandService {
    private readonly assertUtils;
    private readonly commandUtils;
    private readonly queryUtils;
    private readonly config;
    constructor(assertUtils: AssertUtilities, commandUtils: CommandUtilities, queryUtils: QueryUtilities, configService: ConfigService);
    /**
     * handle new deployable (addNewDeployable, version, deployables)
     *   - assert deployable/version does not exist in deployable
     *   - add deployable/version to deployable with status available
     */
    addNewDeployable: (params: {
        version: string;
        deployables: string[];
        actor: string;
    }) => Promise<void>;
    /**
     * handle get deployable list. (getDeployableList, version, deployables?)
     *   - assert deployable/version only has one record in deployable
     *   - if version starts with #.#.# then it is a specific version, return records with status not rejected that match version
     *   - otherwise assume version is actually an environment we want to get a list of all deployables and versions deployed there
     */
    getDeployableList: (params: {
        version: string;
        deployables?: string[];
    }) => Promise<{
        version: string;
        deployable: string;
    }[]>;
    /**
     * handle deployed (markDeployed, version, env, deployables)
     *   - assert deployable/version exists in deployable exactly once
     *   - assert version/env exists in deployed no more than once
     *   - if env/deployable exists in deployed, update version
     *   - if env/deployable does not exist in deployed, add new record with version
     *   - if deployedToProd is true, update deployable
     *      - find deployable with status "rollback" and update to "decommissioned"
     *      - find deployable with status "prod" and update to "rollback"
     *      - find deployable/version set status to "prod"
     *   - if deployedToProd is not true, update deployable
     *      - find deployable/version set status to "pending"
     */
    markDeployed: (params: {
        version: string;
        env: string;
        deployables: string[];
        actor: string;
        deployedToProd: boolean;
    }) => Promise<void>;
}
