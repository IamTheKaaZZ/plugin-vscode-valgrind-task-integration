[![Visual Studio Code extension IamTheKaaZZ.valgrind-debug](https://img.shields.io/visual-studio-marketplace/v/IamTheKaaZZ.valgrind-debug)](https://marketplace.visualstudio.com/items?itemName=IamTheKaaZZ.valgrind-debug)
[![Installs for Visual Studio Code extension IamTheKaaZZ.valgrind-debug](https://img.shields.io/visual-studio-marketplace/i/IamTheKaaZZ.valgrind-debug)](https://marketplace.visualstudio.com/items?itemName=IamTheKaaZZ.valgrind-debug)
[![Rating for Visual Studio Code extension IamTheKaaZZ.valgrind-debug](https://img.shields.io/visual-studio-marketplace/r/IamTheKaaZZ.valgrind-debug)](https://marketplace.visualstudio.com/items?itemName=IamTheKaaZZ.valgrind-debug)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)

# Valgrind Debug

> This is a fork of the abandoned [valgrind-task-integration](https://github.com/1nVitr0/plugin-vscode-valgrind-task-integration) extension by [1nVitr0](https://github.com/1nVitr0), rewritten from the ground up with a new single-launch-config debugger experience.

Debug C/C++ programs under Valgrind with a single launch configuration. Press F5 and the extension handles everything: starting Valgrind, capturing the process ID, and attaching the C++ debugger with `vgdb` — no manual wiring of tasks, commands, or setup scripts.

## Features

- **One launch config** — add a `"type": "valgrind"` entry to `launch.json` and press F5
- **No build system dependency** — point `program` at any executable (CMake, Meson, Make, manual builds)
- **Automatic debugger orchestration** — Valgrind starts first, then the C++ debugger attaches via `vgdb`
- **Lifecycle management** — stopping the debugger kills Valgrind; Valgrind exiting stops the debugger
- **Problem matchers** — Valgrind errors (invalid reads, leaks, etc.) appear in the Problems panel
- **Supports cppdbg and CodeLLDB** — choose your preferred debugger backend
- **Standalone Valgrind task** — run Valgrind without a debugger for quick memory checks
- **Dependency validation** — on launch, the extension checks that `valgrind` and the debugger extension are available and offers to help install them if missing

## Prerequisites

The extension checks these automatically on each launch and shows actionable error messages with install buttons if anything is missing.

### Valgrind (system binary)

Valgrind must be installed and available on your `$PATH` (or configured via `valgrind.binary`).

| OS | Install command |
|----|----------------|
| Debian / Ubuntu | `sudo apt install valgrind` |
| Fedora / RHEL | `sudo dnf install valgrind` |
| Arch | `sudo pacman -S valgrind` |
| macOS (experimental) | `brew install valgrind` |

> If Valgrind is not found, the extension shows an error with a link to the [Valgrind downloads page](https://valgrind.org/downloads/).

### C++ Debugger Extension

One of the following VS Code extensions must be installed:

| Debugger setting | Extension | Install |
|-----------------|-----------|---------|
| `cppdbg` (default) | [C/C++](https://marketplace.visualstudio.com/items?itemName=ms-vscode.cpptools) | `ext install ms-vscode.cpptools` |
| `codelldb` | [CodeLLDB](https://marketplace.visualstudio.com/items?itemName=vadimcn.vscode-lldb) | `ext install vadimcn.vscode-lldb` |

> If the required debugger extension is not installed, the extension offers a one-click "Install Extension" button.

## Quick Start

Add this to your `.vscode/launch.json`:

```jsonc
{
  "name": "Debug with Valgrind",
  "type": "valgrind",
  "request": "launch",
  "program": "${workspaceFolder}/build/myapp",
  "valgrindArgs": ["--leak-check=full"]
}
```

Press **F5**. That's it.

## Launch Configuration Reference

All properties for `"type": "valgrind"` launch configs:

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `program` | `string` | **(required)** | Path to the executable to debug |
| `args` | `string[]` | `[]` | Arguments passed to the target program |
| `cwd` | `string` | workspace folder | Working directory |
| `valgrindArgs` | `string[]` | `[]` | Extra Valgrind flags (e.g. `--leak-check=full`, `--track-origins=yes`) |
| `valgrindBinary` | `string` | `valgrind` | Path to the Valgrind binary (overrides setting) |
| `debugger` | `"cppdbg" \| "codelldb"` | `cppdbg` | Which C++ debugger backend to use |
| `stopAtEntry` | `boolean` | `false` | Stop at the program entry point |
| `setupCommands` | `object[]` | `[]` | Additional GDB setup commands (cppdbg only) |

## Extension Settings

Configure defaults in your VS Code `settings.json`:

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `valgrind.binary` | `string` | `"valgrind"` | Path to the Valgrind binary |
| `valgrind.defaultArgs` | `string[]` | `["--fullpath-after="]` | Default Valgrind arguments for all configs |
| `valgrind.debugger` | `"cppdbg" \| "codelldb"` | `"cppdbg"` | Default C++ debugger backend |
| `valgrind.pidTimeout` | `number` | `30000` | Timeout (ms) to wait for Valgrind to report its PID |

## Standalone Valgrind Task

For quick memory-check runs without a debugger, use the `valgrind` task type in `tasks.json`:

```jsonc
{
  "label": "Valgrind memcheck",
  "type": "valgrind",
  "target": "${workspaceFolder}/build/myapp",
  "args": ["--input", "test.txt"],
  "valgrindArgs": ["--leak-check=full", "--show-leak-kinds=all"]
}
```

Run via **Terminal > Run Task** or bind to a keyboard shortcut. Valgrind errors appear in the Problems panel.

## Problem Matchers

| Matcher | Description |
|---------|-------------|
| `$valgrind` | Matches standard Valgrind output (invalid reads, leaks, etc.) |
| `$valgrind-debug` | Matches Valgrind debug-mode output (stops at "TO DEBUG THIS PROCESS") |

## Examples

### Minimal config

```jsonc
{
  "name": "Valgrind",
  "type": "valgrind",
  "request": "launch",
  "program": "${workspaceFolder}/build/myapp"
}
```

### Full-featured config

```jsonc
{
  "name": "Valgrind (full)",
  "type": "valgrind",
  "request": "launch",
  "program": "${workspaceFolder}/build/myapp",
  "args": ["--verbose"],
  "cwd": "${workspaceFolder}",
  "valgrindArgs": ["--leak-check=full", "--track-origins=yes", "--show-leak-kinds=all"],
  "debugger": "cppdbg",
  "stopAtEntry": false,
  "setupCommands": [
    { "text": "-break-insert main", "description": "Break at main" }
  ]
}
```

### With CMake Tools (optional)

```jsonc
{
  "name": "Valgrind + CMake",
  "type": "valgrind",
  "request": "launch",
  "program": "${command:cmake.launchTargetPath}",
  "valgrindArgs": ["--leak-check=full"]
}
```

### Using CodeLLDB

```jsonc
{
  "name": "Valgrind (CodeLLDB)",
  "type": "valgrind",
  "request": "launch",
  "program": "${workspaceFolder}/build/myapp",
  "debugger": "codelldb"
}
```

## Known Issues

- The problem matcher may not resolve file paths correctly when the first stack frame is in a system library outside your source tree.
- Valgrind is Linux-only in practice. macOS support via Homebrew is experimental and incomplete.

