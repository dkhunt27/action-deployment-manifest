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
     *   - if version=latest, return all records with status "prod" (restrict to deployables if provided)
     *   - if version!=latest, return records with status not rejected that match version (restrict to deployables if provided)
     */
    getDeployableList: (params: {
        version: string;
        deployables?: string[];
    }) => Promise<DeployableRecordType[]>;
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
