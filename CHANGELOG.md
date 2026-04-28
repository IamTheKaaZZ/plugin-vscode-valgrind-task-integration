# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## [1.0.0] — Seamless Valgrind Debugging

### Breaking Changes

- **Removed CMake Tools dependency** — the extension no longer requires `ms-vscode.cmake-tools`. Point `program` at any executable.
- **Removed `valgrind-debug` task type** — replaced by the new `"type": "valgrind"` launch configuration.
- **Removed commands** — `valgrind-task-integration.valgrindPid` and `valgrind-task-integration.valgrindGdbArg` are no longer needed. The extension handles PID capture and debugger attachment internally.

### Added

- **`"type": "valgrind"` launch configuration** — a single `launch.json` entry that starts Valgrind, captures the PID, and attaches the C++ debugger via `vgdb` automatically.
- **CodeLLDB support** — set `"debugger": "codelldb"` to use CodeLLDB instead of cppdbg.
- **Extension settings** — `valgrind.binary`, `valgrind.defaultArgs`, `valgrind.debugger`, `valgrind.pidTimeout`.
- **Dependency validation** — on launch, checks that `valgrind` is installed and the debugger extension is available. Shows actionable error messages with install buttons.
- **Lifecycle management** — stopping the debugger kills Valgrind; Valgrind exiting stops the debugger.
- **Configuration snippet** — "Valgrind: Launch" appears in the launch.json Add Configuration dropdown.

### Changed

- **`valgrind` task type** — simplified schema: `target`, `args`, `valgrindArgs` (replaces nested `valgrind.args`). Reads defaults from extension settings.
- Valgrind errors continue to appear in the Problems panel via the `$valgrind` problem matcher.

---

*This extension is a fork of the abandoned [valgrind-task-integration](https://github.com/1nVitr0/plugin-vscode-valgrind-task-integration) by [1nVitr0](https://github.com/1nVitr0). The pre-1.0.0 versions below were from the original project.*

### 0.1.2 (2021-03-21)

Initial release by the original author (1nVitr0) with CMake-based task integration.

### 0.1.1 (2021-03-21)

Initial package setup.
