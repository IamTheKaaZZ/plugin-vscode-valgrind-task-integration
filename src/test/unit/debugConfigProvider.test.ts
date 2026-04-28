import * as assert from 'assert';
import * as sinon from 'sinon';
import proxyquire from 'proxyquire';
import {
  createMockConfig,
  resetMocks,
  mockWindow,
  mockDebug,
  mockWorkspace,
  mockTasks,
  mockExtensions,
} from './mocks/vscode';
import vscodeMock from './mocks/vscode';

describe('ValgrindDebugConfigProvider', () => {
  let ValgrindDebugConfigProvider: any;
  let provider: any;
  let execFileStub: sinon.SinonStub;

  beforeEach(() => {
    resetMocks();
    execFileStub = sinon.stub();

    mockDebug.onDidTerminateDebugSession = sinon.stub().callsFake((_cb: Function) => {
      return { dispose: sinon.stub() };
    });

    const mod = proxyquire('../../debug/ValgrindDebugConfigProvider', {
      vscode: { ...vscodeMock, '@noCallThru': true },
      '../lib/dependencies': proxyquire('../../lib/dependencies', {
        child_process: { execFile: execFileStub },
        vscode: { ...vscodeMock, '@noCallThru': true },
      }),
    });
    ValgrindDebugConfigProvider = mod.ValgrindDebugConfigProvider;
    provider = new ValgrindDebugConfigProvider();
  });

  afterEach(() => {
    provider.dispose();
    sinon.restore();
  });

  describe('resolveDebugConfiguration', () => {
    it('should fill defaults for empty config and return undefined (no program)', () => {
      const config = {} as any;
      const result = provider.resolveDebugConfiguration(undefined, config);
      assert.strictEqual(result, undefined);
    });

    it('should show error when program is missing', () => {
      const config = { type: 'valgrind', request: 'launch', name: 'test' } as any;
      provider.resolveDebugConfiguration(undefined, config);

      assert.strictEqual(mockWindow.showErrorMessage.calledOnce, true);
      assert.ok(
        mockWindow.showErrorMessage.firstCall.args[0].includes('program')
      );
    });

    it('should return config when program is set', () => {
      const config = {
        type: 'valgrind',
        request: 'launch',
        name: 'test',
        program: './myapp',
      } as any;

      const result = provider.resolveDebugConfiguration(undefined, config);
      assert.ok(result);
      assert.strictEqual(result.program, './myapp');
    });

    it('should set defaults for completely empty config then fail on program', () => {
      const config = {} as any;
      provider.resolveDebugConfiguration(undefined, config);

      assert.strictEqual(config.type, 'valgrind');
      assert.strictEqual(config.request, 'launch');
      assert.strictEqual(config.program, '');
    });
  });

  describe('resolveDebugConfigurationWithSubstitutedVariables', () => {
    function setupValidConfig() {
      mockWorkspace.getConfiguration = sinon.stub().returns(
        createMockConfig({
          binary: 'valgrind',
          defaultArgs: ['--fullpath-after='],
          debugger: 'cppdbg',
          pidTimeout: 1000,
        })
      );
    }

    it('should return undefined when token is cancelled', async () => {
      setupValidConfig();
      const config = { program: './myapp' } as any;
      const token = { isCancellationRequested: true };

      const result = await provider.resolveDebugConfigurationWithSubstitutedVariables(
        undefined,
        config,
        token
      );

      assert.strictEqual(result, undefined);
    });

    it('should return undefined when valgrind is not found', async () => {
      setupValidConfig();
      const err = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      execFileStub.callsFake((_b: string, _a: string[], _o: object, cb: Function) => {
        cb(err);
      });

      const config = {
        type: 'valgrind',
        request: 'launch',
        name: 'test',
        program: './myapp',
      } as any;

      const result = await provider.resolveDebugConfigurationWithSubstitutedVariables(
        undefined,
        config,
        undefined
      );

      assert.strictEqual(result, undefined);
      assert.strictEqual(mockWindow.showErrorMessage.called, true);
    });

    it('should return undefined when debugger extension is missing', async () => {
      setupValidConfig();
      execFileStub.callsFake((_b: string, _a: string[], _o: object, cb: Function) => {
        cb(null, 'valgrind-3.27.0\n');
      });
      mockExtensions.getExtension = sinon.stub().returns(undefined);

      const config = {
        type: 'valgrind',
        request: 'launch',
        name: 'test',
        program: './myapp',
      } as any;

      const result = await provider.resolveDebugConfigurationWithSubstitutedVariables(
        undefined,
        config,
        undefined
      );

      assert.strictEqual(result, undefined);
      assert.strictEqual(mockWindow.showErrorMessage.called, true);
    });

    it('should show timeout error when PID is not captured in time', async () => {
      mockWorkspace.getConfiguration = sinon.stub().returns(
        createMockConfig({
          binary: 'valgrind',
          defaultArgs: [],
          debugger: 'cppdbg',
          pidTimeout: 50, // very short timeout
        })
      );
      execFileStub.callsFake((_b: string, _a: string[], _o: object, cb: Function) => {
        cb(null, 'valgrind-3.27.0\n');
      });
      mockExtensions.getExtension = sinon.stub().returns({ id: 'ms-vscode.cpptools' });
      mockTasks.executeTask = sinon.stub().resolves({ terminate: sinon.stub() });

      const config = {
        type: 'valgrind',
        request: 'launch',
        name: 'test',
        program: './myapp',
      } as any;

      const result = await provider.resolveDebugConfigurationWithSubstitutedVariables(
        undefined,
        config,
        undefined
      );

      assert.strictEqual(result, undefined);
      // Should show timeout error
      assert.strictEqual(mockWindow.showErrorMessage.called, true);
      assert.ok(mockWindow.showErrorMessage.firstCall.args[0].includes('Timed out'));
    });

    it('should use config values from launch configuration over settings', async () => {
      mockWorkspace.getConfiguration = sinon.stub().returns(
        createMockConfig({
          binary: 'system-valgrind',
          defaultArgs: [],
          debugger: 'cppdbg',
          pidTimeout: 50,
        })
      );
      // Valgrind check will use the config-provided binary
      execFileStub.callsFake((bin: string, _a: string[], _o: object, cb: Function) => {
        cb(null, 'valgrind-3.27.0\n');
      });
      mockExtensions.getExtension = sinon.stub().returns({ id: 'ms-vscode.cpptools' });
      mockTasks.executeTask = sinon.stub().resolves({ terminate: sinon.stub() });

      const config = {
        type: 'valgrind',
        request: 'launch',
        name: 'test',
        program: './myapp',
        valgrindBinary: '/custom/valgrind',
        debugger: 'codelldb',
      } as any;

      await provider.resolveDebugConfigurationWithSubstitutedVariables(
        undefined,
        config,
        undefined
      );

      // Should have called execFile with the custom binary
      assert.strictEqual(execFileStub.firstCall.args[0], '/custom/valgrind');
    });
  });

  describe('dispose', () => {
    it('should not throw when no active sessions', () => {
      assert.doesNotThrow(() => provider.dispose());
    });

    it('should be callable multiple times', () => {
      assert.doesNotThrow(() => {
        provider.dispose();
        provider.dispose();
      });
    });
  });

  describe('constructor', () => {
    it('should register onDidTerminateDebugSession listener', () => {
      assert.strictEqual(mockDebug.onDidTerminateDebugSession.called, true);
    });
  });
});
