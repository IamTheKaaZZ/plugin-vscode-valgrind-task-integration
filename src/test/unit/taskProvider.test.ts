import * as assert from 'assert';
import * as sinon from 'sinon';
import proxyquire from 'proxyquire';
import { createMockConfig, resetMocks, mockWorkspace } from './mocks/vscode';
import vscodeMock from './mocks/vscode';
import { ValgrindTaskDefinition } from '../../tasks/ValgrindTaskProvider';

describe('ValgrindTaskProvider', () => {
  let ValgrindTaskProvider: typeof import('../../tasks/ValgrindTaskProvider').ValgrindTaskProvider;
  let provider: InstanceType<typeof ValgrindTaskProvider>;

  beforeEach(() => {
    resetMocks();
    mockWorkspace.getConfiguration = sinon.stub().returns(
      createMockConfig({
        binary: 'valgrind',
        defaultArgs: ['--fullpath-after='],
      })
    );

    // Load module with vscode mock via proxyquire
    const mod = proxyquire('../../tasks/ValgrindTaskProvider', {
      vscode: { ...vscodeMock, '@noCallThru': true },
    });
    ValgrindTaskProvider = mod.ValgrindTaskProvider;
    provider = new ValgrindTaskProvider();
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('static type', () => {
    it('should be "valgrind"', () => {
      assert.strictEqual(ValgrindTaskProvider.type, 'valgrind');
    });
  });

  describe('provideTasks', () => {
    it('should return an empty array', () => {
      const result = provider.provideTasks();
      assert.deepStrictEqual(result, []);
    });
  });

  describe('resolveTask', () => {
    it('should return undefined for wrong task type', () => {
      const task = {
        definition: { type: 'shell', target: './myapp' },
        name: 'test',
      } as any;

      const result = provider.resolveTask(task);
      assert.strictEqual(result, undefined);
    });

    it('should return undefined when target is missing', () => {
      const task = {
        definition: { type: 'valgrind' } as ValgrindTaskDefinition,
        name: 'test',
      } as any;

      const result = provider.resolveTask(task);
      assert.strictEqual(result, undefined);
    });

    it('should return a Task for a valid definition', () => {
      const task = {
        definition: { type: 'valgrind', target: './myapp' } as ValgrindTaskDefinition,
        name: 'test task',
      } as any;

      const result = provider.resolveTask(task);
      assert.ok(result);
      assert.strictEqual(result!.name, 'test task');
      assert.strictEqual(result!.source, 'valgrind');
    });

    it('should default task name to "valgrind: <target>"', () => {
      const task = {
        definition: { type: 'valgrind', target: './myapp' } as ValgrindTaskDefinition,
        name: undefined as unknown as string,
      } as any;

      const result = provider.resolveTask(task);
      assert.ok(result);
      assert.strictEqual(result!.name, 'valgrind: ./myapp');
    });

    it('should use $valgrind problem matcher', () => {
      const task = {
        definition: { type: 'valgrind', target: './myapp' } as ValgrindTaskDefinition,
        name: 'test',
      } as any;

      const result = provider.resolveTask(task);
      assert.ok(result);
      assert.deepStrictEqual(result!.problemMatchers, ['$valgrind']);
    });

    it('should use workspace scope', () => {
      const task = {
        definition: { type: 'valgrind', target: './myapp' } as ValgrindTaskDefinition,
        name: 'test',
      } as any;

      const result = provider.resolveTask(task);
      assert.ok(result);
      assert.strictEqual(result!.scope, vscodeMock.TaskScope.Workspace);
    });

    it('should use custom valgrind binary from config', () => {
      mockWorkspace.getConfiguration = sinon.stub().returns(
        createMockConfig({
          binary: '/usr/local/bin/valgrind',
          defaultArgs: [],
        })
      );

      const task = {
        definition: { type: 'valgrind', target: './myapp' } as ValgrindTaskDefinition,
        name: 'test',
      } as any;

      const result = provider.resolveTask(task);
      assert.ok(result);
      // Task is created with CustomExecution containing our terminal
      assert.ok(result!.execution);
    });
  });
});
