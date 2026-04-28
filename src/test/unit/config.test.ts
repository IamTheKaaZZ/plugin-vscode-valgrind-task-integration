import * as assert from 'assert';
import { buildValgrindArgs, buildDebuggerConfig, ValgrindLaunchConfig, SetupCommand } from '../../lib/config';

describe('buildValgrindArgs', () => {
  it('should return default args when no user args provided', () => {
    const result = buildValgrindArgs(['--fullpath-after='], [], false);
    assert.deepStrictEqual(result, ['--fullpath-after=']);
  });

  it('should merge default and user args', () => {
    const result = buildValgrindArgs(['--fullpath-after='], ['--leak-check=full', '--track-origins=yes'], false);
    assert.deepStrictEqual(result, ['--fullpath-after=', '--leak-check=full', '--track-origins=yes']);
  });

  it('should append --vgdb-error=0 in debug mode', () => {
    const result = buildValgrindArgs(['--fullpath-after='], [], true);
    assert.deepStrictEqual(result, ['--fullpath-after=', '--vgdb-error=0']);
  });

  it('should not append --vgdb-error=0 in non-debug mode', () => {
    const result = buildValgrindArgs(['--fullpath-after='], ['--leak-check=full'], false);
    assert.ok(!result.includes('--vgdb-error=0'));
  });

  it('should place --vgdb-error=0 after all other args', () => {
    const result = buildValgrindArgs(['--fullpath-after='], ['--leak-check=full'], true);
    assert.strictEqual(result[result.length - 1], '--vgdb-error=0');
  });

  it('should handle empty default args', () => {
    const result = buildValgrindArgs([], ['--leak-check=full'], true);
    assert.deepStrictEqual(result, ['--leak-check=full', '--vgdb-error=0']);
  });

  it('should handle both empty args arrays', () => {
    const result = buildValgrindArgs([], [], false);
    assert.deepStrictEqual(result, []);
  });
});

describe('buildDebuggerConfig', () => {
  const baseConfig: ValgrindLaunchConfig = {
    program: '/usr/bin/myapp',
    args: ['--verbose'],
    cwd: '/home/user/project',
  };

  describe('cppdbg', () => {
    it('should produce correct type and request', () => {
      const result = buildDebuggerConfig(baseConfig, 'cppdbg', '12345');
      assert.strictEqual(result.type, 'cppdbg');
      assert.strictEqual(result.request, 'launch');
    });

    it('should set program from config', () => {
      const result = buildDebuggerConfig(baseConfig, 'cppdbg', '12345');
      assert.strictEqual(result.program, '/usr/bin/myapp');
    });

    it('should pass through args', () => {
      const result = buildDebuggerConfig(baseConfig, 'cppdbg', '12345');
      assert.deepStrictEqual(result.args, ['--verbose']);
    });

    it('should use config cwd', () => {
      const result = buildDebuggerConfig(baseConfig, 'cppdbg', '12345');
      assert.strictEqual(result.cwd, '/home/user/project');
    });

    it('should fall back to defaultCwd when cwd not in config', () => {
      const config: ValgrindLaunchConfig = { program: '/usr/bin/myapp' };
      const result = buildDebuggerConfig(config, 'cppdbg', '12345', '/fallback/dir');
      assert.strictEqual(result.cwd, '/fallback/dir');
    });

    it('should fall back to "." when no cwd provided at all', () => {
      const config: ValgrindLaunchConfig = { program: '/usr/bin/myapp' };
      const result = buildDebuggerConfig(config, 'cppdbg', '12345');
      assert.strictEqual(result.cwd, '.');
    });

    it('should set MIMode to gdb', () => {
      const result = buildDebuggerConfig(baseConfig, 'cppdbg', '12345');
      assert.strictEqual(result.MIMode, 'gdb');
    });

    it('should inject vgdb connect command as the last setupCommand', () => {
      const result = buildDebuggerConfig(baseConfig, 'cppdbg', '12345');
      const cmds = result.setupCommands as SetupCommand[];
      const last = cmds[cmds.length - 1];
      assert.strictEqual(last.text, 'target remote | vgdb --pid=12345');
      assert.strictEqual(last.ignoreFailures, false);
    });

    it('should include pretty-printing as the first setupCommand', () => {
      const result = buildDebuggerConfig(baseConfig, 'cppdbg', '12345');
      const cmds = result.setupCommands as SetupCommand[];
      assert.strictEqual(cmds[0].text, '-enable-pretty-printing');
      assert.strictEqual(cmds[0].ignoreFailures, true);
    });

    it('should include user setupCommands between pretty-printing and vgdb', () => {
      const config: ValgrindLaunchConfig = {
        program: '/usr/bin/myapp',
        setupCommands: [
          { text: '-break-insert main', description: 'Break at main' },
        ],
      };
      const result = buildDebuggerConfig(config, 'cppdbg', '99999');
      const cmds = result.setupCommands as SetupCommand[];
      assert.strictEqual(cmds.length, 3);
      assert.strictEqual(cmds[0].text, '-enable-pretty-printing');
      assert.strictEqual(cmds[1].text, '-break-insert main');
      assert.strictEqual(cmds[2].text, 'target remote | vgdb --pid=99999');
    });

    it('should default args to empty array', () => {
      const config: ValgrindLaunchConfig = { program: '/usr/bin/myapp' };
      const result = buildDebuggerConfig(config, 'cppdbg', '12345');
      assert.deepStrictEqual(result.args, []);
    });

    it('should default stopAtEntry to false', () => {
      const config: ValgrindLaunchConfig = { program: '/usr/bin/myapp' };
      const result = buildDebuggerConfig(config, 'cppdbg', '12345');
      assert.strictEqual(result.stopAtEntry, false);
    });

    it('should respect stopAtEntry when true', () => {
      const config: ValgrindLaunchConfig = { program: '/usr/bin/myapp', stopAtEntry: true };
      const result = buildDebuggerConfig(config, 'cppdbg', '12345');
      assert.strictEqual(result.stopAtEntry, true);
    });

    it('should generate session name from program when no name given', () => {
      const config: ValgrindLaunchConfig = { program: '/usr/bin/myapp' };
      const result = buildDebuggerConfig(config, 'cppdbg', '12345');
      assert.strictEqual(result.name, 'Valgrind: /usr/bin/myapp');
    });

    it('should use provided name', () => {
      const config: ValgrindLaunchConfig = { program: '/usr/bin/myapp', name: 'My Debug' };
      const result = buildDebuggerConfig(config, 'cppdbg', '12345');
      assert.strictEqual(result.name, 'My Debug');
    });

    it('should embed the correct PID in vgdb command', () => {
      const result = buildDebuggerConfig(baseConfig, 'cppdbg', '777');
      const cmds = result.setupCommands as SetupCommand[];
      const vgdbCmd = cmds.find((c: SetupCommand) => c.text.includes('vgdb'));
      assert.ok(vgdbCmd);
      assert.strictEqual(vgdbCmd!.text, 'target remote | vgdb --pid=777');
    });
  });

  describe('codelldb', () => {
    it('should produce correct type and request', () => {
      const result = buildDebuggerConfig(baseConfig, 'codelldb', '12345');
      assert.strictEqual(result.type, 'codelldb');
      assert.strictEqual(result.request, 'custom');
    });

    it('should include targetCreateCommands with program', () => {
      const result = buildDebuggerConfig(baseConfig, 'codelldb', '12345');
      const cmds = result.targetCreateCommands as string[];
      assert.strictEqual(cmds.length, 1);
      assert.strictEqual(cmds[0], 'target create "/usr/bin/myapp"');
    });

    it('should include processCreateCommands with vgdb', () => {
      const result = buildDebuggerConfig(baseConfig, 'codelldb', '54321');
      const cmds = result.processCreateCommands as string[];
      assert.strictEqual(cmds.length, 1);
      assert.strictEqual(cmds[0], 'gdb-remote | vgdb --pid=54321');
    });

    it('should use config cwd', () => {
      const result = buildDebuggerConfig(baseConfig, 'codelldb', '12345');
      assert.strictEqual(result.cwd, '/home/user/project');
    });

    it('should fall back to defaultCwd', () => {
      const config: ValgrindLaunchConfig = { program: '/usr/bin/myapp' };
      const result = buildDebuggerConfig(config, 'codelldb', '12345', '/fallback');
      assert.strictEqual(result.cwd, '/fallback');
    });
  });
});
