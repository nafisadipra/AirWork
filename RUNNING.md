# Running & Managing AirWork

This document provides complete instructions for setting up, running, building, and troubleshooting **AirWork** on macOS, Windows, and Linux.

---

## 📋 Table of Contents

1. [Prerequisites](#-prerequisites)
2. [Quick Start](#-quick-start)
3. [Running in Development Mode](#-running-in-development-mode)
4. [Building for Production](#-building-for-production)
5. [Troubleshooting Common Issues](#-troubleshooting-common-issues)
   - [Electron ENOENT Error (Missing Executable)](#1-electron-enoent-error-missing-executable)
   - [Native Module Rebuilding Errors](#2-native-module-rebuilding-errors)
   - [Port 3000 Already in Use](#3-port-3000-already-in-use)
6. [NPM Scripts Reference](#-npm-scripts-reference)

---

## 🛠 Prerequisites

Ensure you have the following installed on your machine:

- **Node.js**: `v24.0.0` or higher (Node 18+ supported)
- **npm**: `v10.0.0` or higher
- **Native Build Tools** (Required for native dependencies like `better-sqlite3-multiple-ciphers` and `sodium-native`):
  - **macOS**: Install Xcode Command Line Tools by running `xcode-select --install` in terminal.
  - **Windows**: Install Visual Studio Build Tools (with "Desktop development with C++" workload) or run `npm install --global --production windows-build-tools` in an administrative shell.
  - **Linux**: Install `build-essential`, `python3`, and `pkg-config` (e.g. `sudo apt install build-essential python3 pkg-config`).

---

## ⚡ Quick Start

```bash
# 1. Clone the repository and navigate into the directory
cd AirWork

# 2. Install node dependencies
npm install

# 3. Start the application in development mode
npm run dev
```

---

## 💻 Running in Development Mode

When running `npm run dev`, two processes run concurrently:
1. **Next.js Dev Server**: Starts on `http://localhost:3000` with Turbopack.
2. **Electron Main Process**: Compiles TypeScript files in `./electron` to `./dist-electron` and opens the desktop application window once `localhost:3000` is ready.

```bash
npm run dev
```

### Running Processes Separately

If you prefer to run Next.js and Electron in separate terminal windows for easier log inspection:

- **Terminal 1** (Next.js server):
  ```bash
  npm run dev:next
  ```

- **Terminal 2** (Electron app):
  ```bash
  npm run dev:electron
  ```

---

## 📦 Building for Production

### 1. Compile Electron and Next.js Code

```bash
# Build Next.js frontend into static bundle
npm run build:next

# Compile Electron main process TypeScript files
npm run build:electron
```

### 2. Package for Distribution

Generate installer packages for your target platform:

- **macOS** (DMG & Zip):
  ```bash
  npm run build:mac
  ```
  *(Output: `release/AirWork-1.0.0.dmg`)*

- **Windows** (NSIS Installer & Portable):
  ```bash
  npm run build:win
  ```
  *(Output: `release/AirWork Setup 1.0.0.exe`)*

- **Linux** (AppImage, DEB, RPM):
  ```bash
  npm run build:linux
  ```
  *(Output files in `release/`)*

- **All Platforms**:
  ```bash
  npm run build:all
  ```

---

## ❓ Troubleshooting Common Issues

### 1. Electron ENOENT Error (Missing Executable)

#### **Symptom:**
```text
Error: spawn /Users/.../node_modules/electron/dist/Electron.app/Contents/MacOS/Electron ENOENT
```

#### **Cause:**
This error occurs when the Electron binary failed to download or extract during `npm install` (e.g., due to a interrupted download or skipped postinstall step).

#### **Solution:**
Manually execute the Electron installation script to download the missing binary:

```bash
node node_modules/electron/install.js
```

After running the command above, test running the app again:
```bash
npm run dev
```

---

### 2. Native Module Rebuilding Errors

#### **Symptom:**
Errors relating to `better-sqlite3-multiple-ciphers`, `sodium-native`, or `@signalapp/libsignal-client` ABI mismatches when Electron starts.

#### **Solution:**
Rebuild native C/C++ dependencies for the current Electron version:

```bash
npm run rebuild
```

---

### 3. Port 3000 Already in Use

#### **Symptom:**
Next.js fails to start on port 3000 or Electron connects to an old running process on port 3000.

#### **Solution:**
Kill any orphaned node processes listening on port 3000:

- **macOS / Linux**:
  ```bash
  lsof -ti:3000 | xargs kill -9
  ```
- **Windows (PowerShell)**:
  ```powershell
  Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess | Stop-Process
  ```

---

## 📜 NPM Scripts Reference

| Command | Action |
| :--- | :--- |
| `npm run dev` | Runs Next.js dev server and Electron app concurrently |
| `npm run dev:next` | Starts Next.js dev server standalone (`http://localhost:3000`) |
| `npm run dev:electron` | Waits for `http://localhost:3000`, compiles TypeScript electron code, and launches Electron |
| `npm run build` | Builds Next.js frontend, compiles Electron code, and builds installer for host OS |
| `npm run build:next` | Builds production Next.js frontend static output |
| `npm run build:electron` | Compiles `electron/tsconfig.json` TypeScript code into `dist-electron/` |
| `npm run build:mac` | Builds macOS distribution installers (`.dmg`, `.zip`) |
| `npm run build:win` | Builds Windows distribution installers (`.exe`) |
| `npm run build:linux` | Builds Linux distribution packages (`.AppImage`, `.deb`, `.rpm`) |
| `npm run start` | Compiles Electron code and launches Electron app directly |
| `npm run rebuild` | Rebuilds native C/C++ modules using `@electron/rebuild` |
| `npm run type-check` | Performs TypeScript type checking without emitting files |
| `npm run lint` | Runs Next.js ESLint checks |
