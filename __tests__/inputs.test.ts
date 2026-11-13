import { beforeEach, describe, expect, jest, test } from '@jest/globals';

// Mock @actions/core
let rawInputs: Record<string, string>;
jest.unstable_mockModule('@actions/core', () => ({
  getInput: (name: string) => rawInputs[name] ?? ''
}));

// Import after mocking
const { parseInputs } = await import('../src/inputs');

describe('parseInputs', () => {
  beforeEach(() => {
    rawInputs = {
      command: 'getDeployableList',
      ifAddNewDeployableExists: 'error',
      version: '2026.11.13-1',
      actor: 'test-user',
      deployables: '',
      deployableTable: 'deployableTable',
      deployedTable: 'deployedTable'
    };
  });

  test('should read fallbackEnv', () => {
    rawInputs.fallbackEnv = 'qa';

    expect(parseInputs().fallbackEnv).toBe('qa');
  });

  test('should leave fallbackEnv undefined when not provided', () => {
    expect(parseInputs().fallbackEnv).toBeUndefined();
  });
});
