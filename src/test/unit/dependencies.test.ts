import * as assert from 'assert';
import * as sinon from 'sinon';
import proxyquire from 'proxyquire';
import {
  mockWindow,
  mockEnv,
  mockExtensions,
  mockCommands,
  resetMocks,
} from './mocks/vscode';

describe('checkValgrindInstalled', () => {
  let execFileStub: sinon.SinonStub;
  let checkValgrindInstalled: typeof import('../../lib/dependencies').checkValgrindInstalled;

  beforeEach(() => {
    resetMocks();
    execFileStub = sinon.stub();

    const deps = proxyquire('../../lib/dependencies', {
      child_process: { execFile: execFileStub },
      vscode: {
        window: mockWindow,
        env: mockEnv,
        extensions: mockExtensions,
        commands: mockCommands,
        Uri: { parse: (s: string) => s },
        '@noCallThru': true,
      },
    });
    checkValgrindInstalled = deps.checkValgrindInstalled;
  });

  afterEach(() => {
    sinon.restore();
  });

  it('should return ok with version string on success', async () => {
    execFileStub.callsFake((_bin: string, _args: string[], _opts: object, cb: Function) => {
      cb(null, 'valgrind-3.27.0\nmore output\n');
    });

    const result = await checkValgrindInstalled('valgrind');
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.message, 'valgrind-3.27.0');
  });

  it('should return ENOENT message when binary not found', async () => {
    const error = Object.assign(new Error('spawn ENOENT'), { code: 'ENOENT' });
    execFileStub.callsFake((_bin: string, _args: string[], _opts: object, cb: Function) => {
      cb(error);
    });

    const result = await checkValgrindInstalled('/nonexistent/valgrind');
    assert.strictEqual(result.ok, false);
    assert.ok(result.message!.includes('was not found on PATH'));
    assert.ok(result.message!.includes('/nonexistent/valgrind'));
  });

  it('should return EACCES message when binary not executable', async () => {
    const error = Object.assign(new Error('spawn EACCES'), { code: 'EACCES' });
    execFileStub.callsFake((_bin: string, _args: string[], _opts: object, cb: Function) => {
      cb(error);
    });

    const result = await checkValgrindInstalled('valgrind');
    assert.strictEqual(result.ok, false);
    assert.ok(result.message!.includes('is not executable'));
  });

  it('should return generic error message for other failures', async () => {
    const error = Object.assign(new Error('something broke'), { code: 'UNKNOWN' });
    execFileStub.callsFake((_bin: string, _args: string[], _opts: object, cb: Function) => {
      cb(error);
    });

    const result = await checkValgrindInstalled('valgrind');
    assert.strictEqual(result.ok, false);
    assert.ok(result.message!.includes('failed to run'));
    assert.ok(result.message!.includes('something broke'));
  });

  it('should call execFile with --version and 5s timeout', async () => {
    execFileStub.callsFake((_bin: string, _args: string[], _opts: object, cb: Function) => {
      cb(null, 'valgrind-3.27.0\n');
    });

    await checkValgrindInstalled('myvalgrind');
    assert.strictEqual(execFileStub.calledOnce, true);
    const [bin, args, opts] = execFileStub.firstCall.args;
    assert.strictEqual(bin, 'myvalgrind');
    assert.deepStrictEqual(args, ['--version']);
    assert.strictEqual(opts.timeout, 5000);
  });

  it('should handle empty stdout gracefully', async () => {
    execFileStub.callsFake((_bin: string, _args: string[], _opts: object, cb: Function) => {
      cb(null, '');
    });

    const result = await checkValgrindInstalled('valgrind');
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.message, '');
  });
});

describe('checkDebuggerExtension', () => {
  let checkDebuggerExtension: typeof import('../../lib/dependencies').checkDebuggerExtension;

  beforeEach(() => {
    resetMocks();
    const deps = proxyquire('../../lib/dependencies', {
      child_process: { execFile: sinon.stub() },
      vscode: {
        window: mockWindow,
        env: mockEnv,
        extensions: mockExtensions,
        commands: mockCommands,
        Uri: { parse: (s: string) => s },
        '@noCallThru': true,
      },
    });
    checkDebuggerExtension = deps.checkDebuggerExtension;
  });

  afterEach(() => {
    sinon.restore();
  });

  it('should return ok for unknown debugger types', () => {
    const result = checkDebuggerExtension('unknownDebugger');
    assert.strictEqual(result.ok, true);
  });

  it('should return ok when cppdbg extension is installed', () => {
    mockExtensions.getExtension = sinon.stub().returns({ id: 'ms-vscode.cpptools' });
    const result = checkDebuggerExtension('cppdbg');
    assert.strictEqual(result.ok, true);
  });

  it('should return not ok when cppdbg extension is not installed', () => {
    mockExtensions.getExtension = sinon.stub().returns(undefined);
    const result = checkDebuggerExtension('cppdbg');
    assert.strictEqual(result.ok, false);
    assert.ok(result.message!.includes('ms-vscode.cpptools'));
  });

  it('should return ok when codelldb extension is installed', () => {
    mockExtensions.getExtension = sinon.stub().returns({ id: 'vadimcn.vscode-lldb' });
    const result = checkDebuggerExtension('codelldb');
    assert.strictEqual(result.ok, true);
  });

  it('should return not ok when codelldb extension is not installed', () => {
    mockExtensions.getExtension = sinon.stub().returns(undefined);
    const result = checkDebuggerExtension('codelldb');
    assert.strictEqual(result.ok, false);
    assert.ok(result.message!.includes('vadimcn.vscode-lldb'));
  });
});

describe('validateDependencies', () => {
  let execFileStub: sinon.SinonStub;
  let validateDependencies: typeof import('../../lib/dependencies').validateDependencies;

  beforeEach(() => {
    resetMocks();
    execFileStub = sinon.stub();
    const deps = proxyquire('../../lib/dependencies', {
      child_process: { execFile: execFileStub },
      vscode: {
        window: mockWindow,
        env: mockEnv,
        extensions: mockExtensions,
        commands: mockCommands,
        Uri: { parse: (s: string) => s },
        '@noCallThru': true,
      },
    });
    validateDependencies = deps.validateDependencies;
  });

  afterEach(() => {
    sinon.restore();
  });

  it('should return true when all dependencies are satisfied', async () => {
    execFileStub.callsFake((_b: string, _a: string[], _o: object, cb: Function) => {
      cb(null, 'valgrind-3.27.0\n');
    });
    mockExtensions.getExtension = sinon.stub().returns({ id: 'ms-vscode.cpptools' });

    const result = await validateDependencies('valgrind', 'cppdbg');
    assert.strictEqual(result, true);
  });

  it('should return false and show error when valgrind is not found', async () => {
    const err = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    execFileStub.callsFake((_b: string, _a: string[], _o: object, cb: Function) => {
      cb(err);
    });

    const result = await validateDependencies('valgrind', 'cppdbg');
    assert.strictEqual(result, false);
    assert.strictEqual(mockWindow.showErrorMessage.calledOnce, true);
  });

  it('should open install URL when user clicks Show Install Instructions', async () => {
    const err = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    execFileStub.callsFake((_b: string, _a: string[], _o: object, cb: Function) => {
      cb(err);
    });
    mockWindow.showErrorMessage = sinon.stub().resolves('Show Install Instructions');

    const result = await validateDependencies('valgrind', 'cppdbg');
    assert.strictEqual(result, false);
    assert.strictEqual(mockEnv.openExternal.calledOnce, true);
  });

  it('should return false and show error when debugger extension is missing', async () => {
    execFileStub.callsFake((_b: string, _a: string[], _o: object, cb: Function) => {
      cb(null, 'valgrind-3.27.0\n');
    });
    mockExtensions.getExtension = sinon.stub().returns(undefined);

    const result = await validateDependencies('valgrind', 'cppdbg');
    assert.strictEqual(result, false);
    assert.strictEqual(mockWindow.showErrorMessage.calledOnce, true);
  });

  it('should install extension when user clicks Install Extension', async () => {
    execFileStub.callsFake((_b: string, _a: string[], _o: object, cb: Function) => {
      cb(null, 'valgrind-3.27.0\n');
    });
    mockExtensions.getExtension = sinon.stub().returns(undefined);
    mockWindow.showErrorMessage = sinon.stub().resolves('Install Extension');

    const result = await validateDependencies('valgrind', 'cppdbg');
    assert.strictEqual(result, false);
    assert.strictEqual(mockCommands.executeCommand.calledOnce, true);
    assert.ok(
      mockCommands.executeCommand.firstCall.args[1] === 'ms-vscode.cpptools'
    );
  });
});
