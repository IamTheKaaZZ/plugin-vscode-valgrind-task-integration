import * as assert from 'assert';
import * as sinon from 'sinon';
import proxyquire from 'proxyquire';
import { EventEmitter } from 'events';
import { ValgrindTerminalOptions } from '../../tasks/ValgrindTaskTerminal';
import vscodeMock from './mocks/vscode';

class FakeProcess extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  killed = false;

  kill(signal?: string): boolean {
    this.killed = true;
    this._lastSignal = signal;
    return true;
  }

  _lastSignal?: string;
}

describe('ValgrindTaskTerminal', () => {
  let spawnStub: sinon.SinonStub;
  let fakeProc: FakeProcess;
  let ValgrindTaskTerminal: any;

  beforeEach(() => {
    fakeProc = new FakeProcess();
    spawnStub = sinon.stub().returns(fakeProc);

    const mod = proxyquire('../../tasks/ValgrindTaskTerminal', {
      child_process: { spawn: spawnStub, '@noCallThru': true },
      vscode: { ...vscodeMock, '@noCallThru': true },
    });
    ValgrindTaskTerminal = mod.ValgrindTaskTerminal;
  });

  afterEach(() => {
    sinon.restore();
  });

  function createTerminal(overrides: Partial<ValgrindTerminalOptions> = {}): any {
    return new ValgrindTaskTerminal({
      valgrindBinary: 'valgrind',
      valgrindArgs: ['--vgdb-error=0'],
      target: './myapp',
      targetArgs: ['--flag'],
      ...overrides,
    });
  }

  describe('open', () => {
    it('should fire a startup message with binary, args, and target', () => {
      const terminal = createTerminal();
      const lines: string[] = [];
      terminal.onDidWrite((line: string) => lines.push(line));

      terminal.open(undefined);

      assert.ok(lines.length > 0);
      assert.ok(lines[0].includes('valgrind'));
      assert.ok(lines[0].includes('--vgdb-error=0'));
      assert.ok(lines[0].includes('./myapp'));
      assert.ok(lines[0].includes('--flag'));
    });

    it('should spawn valgrind with correct arguments', () => {
      const terminal = createTerminal();
      terminal.open(undefined);

      assert.strictEqual(spawnStub.calledOnce, true);
      const [bin, args] = spawnStub.firstCall.args;
      assert.strictEqual(bin, 'valgrind');
      assert.deepStrictEqual(args, ['--vgdb-error=0', './myapp', '--flag']);
    });

    it('should default targetArgs to empty array', () => {
      const terminal = createTerminal({ targetArgs: undefined });
      terminal.open(undefined);

      const [, args] = spawnStub.firstCall.args;
      assert.deepStrictEqual(args, ['--vgdb-error=0', './myapp']);
    });

    it('should forward stdout data through writeEmitter', () => {
      const terminal = createTerminal();
      const lines: string[] = [];
      terminal.onDidWrite((line: string) => lines.push(line));

      terminal.open(undefined);
      fakeProc.stdout.emit('data', Buffer.from('==1234== Hello\n==1234== World\n'));

      // First line is the startup message, rest are forwarded
      const forwarded = lines.filter((l) => l.includes('Hello') || l.includes('World'));
      assert.strictEqual(forwarded.length, 2);
    });

    it('should forward stderr data through writeEmitter', () => {
      const terminal = createTerminal();
      const lines: string[] = [];
      terminal.onDidWrite((line: string) => lines.push(line));

      terminal.open(undefined);
      fakeProc.stderr.emit('data', Buffer.from('==1234== Error info\n'));

      const forwarded = lines.filter((l) => l.includes('Error info'));
      assert.strictEqual(forwarded.length, 1);
    });

    it('should fire closeEmitter with exit code', () => {
      const terminal = createTerminal();
      const codes: number[] = [];
      terminal.onDidClose((code: number) => codes.push(code));

      terminal.open(undefined);
      fakeProc.emit('exit', 42);

      assert.deepStrictEqual(codes, [42]);
    });

    it('should fire closeEmitter with 0 when exit code is null', () => {
      const terminal = createTerminal();
      const codes: number[] = [];
      terminal.onDidClose((code: number) => codes.push(code));

      terminal.open(undefined);
      fakeProc.emit('exit', null);

      assert.deepStrictEqual(codes, [0]);
    });

    it('should invoke onReady callback when PID and vgdb-ready line appear', (done) => {
      const terminal = createTerminal({
        onReady: (pid) => {
          assert.strictEqual(pid, '9999');
          done();
        },
      });

      terminal.open(undefined);

      // First emit a line with PID
      fakeProc.stderr.emit('data', Buffer.from('==9999== Memcheck, a memory error detector\n'));
      // Then emit the vgdb-ready line
      fakeProc.stderr.emit(
        'data',
        Buffer.from('==9999== TO DEBUG THIS PROCESS using GDB: start GDB\n')
      );
    });

    it('should not invoke onReady until vgdb-ready line appears', () => {
      let called = false;
      const terminal = createTerminal({
        onReady: () => {
          called = true;
        },
      });

      terminal.open(undefined);

      // Emit PID line but NOT the vgdb-ready line
      fakeProc.stderr.emit('data', Buffer.from('==9999== Memcheck, a memory error detector\n'));

      assert.strictEqual(called, false, 'onReady should not be called without vgdb ready');
    });

    it('should invoke onPid callback on first PID line (no onReady)', (done) => {
      const terminal = createTerminal({
        onPid: (pid) => {
          assert.strictEqual(pid, '5555');
          done();
        },
        onReady: undefined,
      });

      terminal.open(undefined);
      fakeProc.stderr.emit('data', Buffer.from('==5555== Memcheck\n'));
    });

    it('should not set up listeners when neither callback is provided', () => {
      const terminal = createTerminal({ onPid: undefined, onReady: undefined });
      terminal.open(undefined);

      // Should not throw when emitting output
      fakeProc.stderr.emit('data', Buffer.from('==1234== some output\n'));
    });
  });

  describe('close', () => {
    it('should send SIGTERM to a running process', () => {
      const terminal = createTerminal();
      terminal.open(undefined);

      terminal.close();

      assert.strictEqual(fakeProc.killed, true);
      assert.strictEqual(fakeProc._lastSignal, 'SIGTERM');
    });

    it('should not throw if process was already killed', () => {
      const terminal = createTerminal();
      terminal.open(undefined);
      fakeProc.killed = true;

      assert.doesNotThrow(() => terminal.close());
    });

    it('should not throw if open was never called', () => {
      const terminal = createTerminal();
      assert.doesNotThrow(() => terminal.close());
    });
  });

  describe('forwardOutput', () => {
    it('should split multi-line buffers and append \\r\\n', () => {
      const terminal = createTerminal();
      const lines: string[] = [];
      terminal.onDidWrite((line: string) => lines.push(line));

      terminal.open(undefined);
      const startupLines = lines.length;

      fakeProc.stdout.emit('data', Buffer.from('line1\nline2\nline3\n'));

      // 3 lines + 1 trailing empty string from split
      const forwarded = lines.slice(startupLines);
      assert.ok(forwarded.length >= 3);
      assert.ok(forwarded[0].includes('line1'));
      assert.ok(forwarded[0].endsWith('\r\n'));
      assert.ok(forwarded[1].includes('line2'));
      assert.ok(forwarded[2].includes('line3'));
    });

    it('should handle \\r\\n line endings in input', () => {
      const terminal = createTerminal();
      const lines: string[] = [];
      terminal.onDidWrite((line: string) => lines.push(line));

      terminal.open(undefined);
      const startupLines = lines.length;

      fakeProc.stdout.emit('data', Buffer.from('line1\r\nline2\r\n'));

      const forwarded = lines.slice(startupLines);
      assert.ok(forwarded.length >= 2);
      assert.ok(forwarded[0].includes('line1'));
    });
  });

  describe('waitForReady edge cases', () => {
    it('should capture PID from early line and resolve on later ready line', (done) => {
      const terminal = createTerminal({
        onReady: (pid) => {
          assert.strictEqual(pid, '7777');
          done();
        },
      });

      terminal.open(undefined);

      // PID appears first
      fakeProc.stderr.emit('data', Buffer.from('==7777== Using Valgrind-3.27.0\n'));
      // Several non-ready lines
      fakeProc.stderr.emit('data', Buffer.from('==7777== Copyright (C) 2000-2024\n'));
      fakeProc.stderr.emit('data', Buffer.from('==7777== Command: ./myapp\n'));
      // Ready line finally arrives
      fakeProc.stderr.emit(
        'data',
        Buffer.from('==7777== TO DEBUG THIS PROCESS using GDB\n')
      );
    });

    it('should handle PID and ready in the same output chunk', (done) => {
      const terminal = createTerminal({
        onReady: (pid) => {
          assert.strictEqual(pid, '3333');
          done();
        },
      });

      terminal.open(undefined);

      fakeProc.stderr.emit(
        'data',
        Buffer.from(
          '==3333== Memcheck\n==3333== TO DEBUG THIS PROCESS\n'
        )
      );
    });
  });
});
