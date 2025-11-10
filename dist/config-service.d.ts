import type { ConfigurationType } from './types.ts';
export declare class ConfigService {
    private readonly deployableTable;
    private readonly deployedTable;
    constructor(deployableTable: string, deployedTable: string);
    config: () => ConfigurationType;
}
