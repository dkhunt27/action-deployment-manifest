import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { DeploymentManifestCommand, IfAddNewDeployableExists } from '../src/types';
import type { DeploymentManifestInputs } from '../src/types';

// Mock @actions/core
const mockSetOutput = jest.fn();
const mockInfo = jest.fn();
const mockWarning = jest.fn();
const mockSetFailed = jest.fn();
jest.unstable_mockModule('@actions/core', () => ({
  setOutput: mockSetOutput,
  info: mockInfo,
  warning: mockWarning,
  setFailed: mockSetFailed
}));

// Mock factory so no DynamoDB client is built
const mockGetDeployableList = jest.fn<(params: unknown) => Promise<unknown[]>>();
jest.unstable_mockModule('../src/factory', () => ({
  buildCommandService: async () => ({ getDeployableList: mockGetDeployableList })
}));

// Import after mocking
const { execute } = await import('../src/main');

const outputs = (): Record<string, unknown> =>
  Object.fromEntries(mockSetOutput.mock.calls.map(([name, value]) => [name, value]));

describe('execute getDeployableList', () => {
  let inputs: DeploymentManifestInputs;

  beforeEach(() => {
    jest.clearAllMocks();
    inputs = {
      command: DeploymentManifestCommand.GET_DEPLOYABLE_LIST,
      ifAddNewDeployableExists: IfAddNewDeployableExists.ERROR,
      version: '1.0.2',
      actor: 'test-user',
      deployables: [],
      deployableTable: 'deployableTable',
      deployedTable: 'deployedTable',
      awsRegion: 'us-east-1'
    };
  });

  describe('without fallbackEnv (outputs must stay byte-identical to v2.0.2)', () => {
    test('multiple deployables', async () => {
      mockGetDeployableList.mockResolvedValue([
        { version: '1.0.2', deployable: 'app4' },
        { version: '1.0.2', deployable: 'app1' }
      ]);

      await execute(inputs);

      expect(outputs()).toEqual({
        hasDeployables: true,
        deployables:
          '[{"deployable":"app1","version":"1.0.2"},{"deployable":"app4","version":"1.0.2"}]',
        deployablesFull:
          '[{"version":"1.0.2","deployable":"app1"},{"version":"1.0.2","deployable":"app4"}]',
        deployablesPrettyString:
          '[\n  {"deployable":"app1","version":"1.0.2"},\n  {"deployable":"app4","version":"1.0.2"}\n]'
      });
    });

    test('single deployable', async () => {
      mockGetDeployableList.mockResolvedValue([{ version: '1.0.2', deployable: 'app1' }]);

      await execute(inputs);

      expect(outputs()).toEqual({
        hasDeployables: true,
        deployables: '[{"deployable":"app1","version":"1.0.2"}]',
        deployablesFull: '[{"version":"1.0.2","deployable":"app1"}]',
        deployablesPrettyString: '[\n  {"deployable":"app1","version":"1.0.2"}\n]'
      });
    });

    test('no deployables', async () => {
      mockGetDeployableList.mockResolvedValue([]);

      await execute(inputs);

      expect(outputs()).toEqual({
        hasDeployables: false,
        deployables: '[]',
        deployablesFull: '[]',
        deployablesPrettyString: '[]'
      });
    });

    test('empty fallbackEnv is treated as not set', async () => {
      mockGetDeployableList.mockResolvedValue([
        { version: '1.0.2', deployable: 'app4' },
        { version: '1.0.2', deployable: 'app1' }
      ]);

      await execute({ ...inputs, fallbackEnv: '' } as DeploymentManifestInputs);

      expect(outputs().deployablesPrettyString).toBe(
        '[\n  {"deployable":"app1","version":"1.0.2"},\n  {"deployable":"app4","version":"1.0.2"}\n]'
      );
    });
  });

  describe('with fallbackEnv', () => {
    beforeEach(() => {
      inputs = {
        ...inputs,
        version: '2026.11.13-1',
        fallbackEnv: 'qa'
      } as DeploymentManifestInputs;
    });

    test('passes fallbackEnv through to the command', async () => {
      mockGetDeployableList.mockResolvedValue([]);

      await execute({ ...inputs, deployables: ['app1'] });

      expect(mockGetDeployableList).toHaveBeenCalledWith({
        version: '2026.11.13-1',
        fallbackEnv: 'qa',
        deployables: ['app1']
      });
    });

    test('mixed versions: deployables/deployablesFull keep their shape, pretty string marks fallback env items', async () => {
      mockGetDeployableList.mockResolvedValue([
        { version: '2026.11.13-1', deployable: 'web' },
        { version: '2026.11.01-3', deployable: 'servicing-api', fromEnv: 'qa' },
        { version: '2026.10.30-1', deployable: 'admin', fromEnv: 'qa' }
      ]);

      await execute(inputs);

      expect(outputs()).toEqual({
        hasDeployables: true,
        deployables:
          '[{"deployable":"admin","version":"2026.10.30-1"},' +
          '{"deployable":"servicing-api","version":"2026.11.01-3"},' +
          '{"deployable":"web","version":"2026.11.13-1"}]',
        deployablesFull:
          '[{"version":"2026.10.30-1","deployable":"admin"},' +
          '{"version":"2026.11.01-3","deployable":"servicing-api"},' +
          '{"version":"2026.11.13-1","deployable":"web"}]',
        deployablesPrettyString:
          '[\n' +
          '  admin@2026.10.30-1 (from qa),\n' +
          '  servicing-api@2026.11.01-3 (from qa),\n' +
          '  web@2026.11.13-1\n' +
          ']'
      });
    });

    test('no deployables', async () => {
      mockGetDeployableList.mockResolvedValue([]);

      await execute(inputs);

      expect(outputs()).toEqual({
        hasDeployables: false,
        deployables: '[]',
        deployablesFull: '[]',
        deployablesPrettyString: '[]'
      });
    });
  });
});
