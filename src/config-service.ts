import type { ConfigurationType } from './types';

export class ConfigService {
  constructor(
    private readonly deployableTable: string,
    private readonly deployedTable: string
  ) {}

  config = (): ConfigurationType => {
    return {
      deployableTable: this.deployableTable,
      deployedTable: this.deployedTable
    };
  };
}
