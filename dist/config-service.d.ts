import type { ConfigurationType } from './types';
export declare class ConfigService {
    private readonly deployableTable;
    private readonly deployedTable;
    constructor(deployableTable: string, deployedTable: string);
    config: () => ConfigurationType;
}
