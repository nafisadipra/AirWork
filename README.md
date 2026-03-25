# 🔒 AirWork - Secure Local-First Collaboration Platform

**End-to-end encrypted, offline-first collaboration platform built with Next.js, Electron, and Signal Protocol.**

-----

## Features

  - **Military-Grade Encryption** - Signal Protocol with perfect forward secrecy
  - **True Offline-First** - Works completely offline, syncs P2P when on same LAN
  - **Zero Cloud Dependency** - No servers, no cloud, your data stays on your device
  - **Real-Time Collaboration** - CRDTs (Yjs) handle conflicts automatically
  - **Encrypted Storage** - SQLCipher database encryption (AES-256)
  - **Cross-Platform** - Windows, macOS, Linux
  - **Modern Stack** - Next.js 14, TypeScript, Tailwind CSS
  - **Security Hardened** - Comprehensive security audit checklist included

-----

## Quick Start

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build

# Create installer for your platform
npm run build:mac     # macOS
npm run build:win     # Windows
npm run build:linux   # Linux
```

-----

## 📋 Requirements

  - **Node.js** 18+
  - **npm** 9+
  - **macOS**: Xcode Command Line Tools
  - **Windows**: Visual Studio Build Tools or windows-build-tools
  - **Linux**: gcc, make, python3

-----

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Next.js Frontend                   │
│              (TypeScript + React)                   │
└──────────────────┬──────────────────────────────────┘
                   │ IPC Bridge (Type-safe)
┌──────────────────┴──────────────────────────────────┐
│              Electron Main Process                  │
├─────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │   Signal    │  │ Noise Proto  │  │  SQLCipher │ │
│  │  Protocol   │  │ (P2P Auth)   │  │ (Database) │ │
│  └─────────────┘  └──────────────┘  └────────────┘ │
│  ┌─────────────────────────────────────────────────┤
│  │          Yjs CRDT (Collaboration)               │
│  └─────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────┤
│  │      P2P Manager (LAN Discovery & Sync)         │
│  └─────────────────────────────────────────────────┘
└─────────────────────────────────────────────────────┘
```

-----

## 🔐 Security Features

### End-to-End Encryption

  - **Signal Protocol** for peer-to-peer messaging
  - **Perfect forward secrecy** - compromising current key doesn't expose past messages
  - **Future secrecy** - self-healing from key compromises
  - **Out-of-band verification** - Safety numbers like Signal app

### Database Encryption

  - **Full database encryption** with SQLCipher
  - **Argon2id** password hashing (memory-hard, ASIC-resistant)
  - **Unique salt** per user
  - **No plaintext metadata** leakage

### P2P Security

  - **Noise Protocol** for authenticated handshakes
  - **Mutual authentication** - prevents MITM attacks
  - **Encrypted announcements** - discovery messages are signed
  - **Rate limiting** - prevents DoS attacks
  - **Peer banning** - automatic malicious peer blocking

### CRDT Security

  - **Update validation** - size limits, structure checks
  - **Garbage collection** - prevents tombstone accumulation
  - **Document size limits** - prevents memory exhaustion
  - **Peer isolation** - malicious updates don't crash others

### Electron Security

  - **Context isolation** - renderer process sandboxed
  - **No Node.js in renderer** - prevents code injection
  - **Content Security Policy** - blocks XSS attacks
  - **Navigation blocking** - prevents phishing
  - **Code signing** - verifies binary integrity

-----

## 📖 Documentation

  - **[COMPLETE-IMPLEMENTATION-GUIDE.md](https://www.google.com/search?q=./COMPLETE-IMPLEMENTATION-GUIDE.md)** - Full implementation details
  - **[SECURITY-AUDIT-CHECKLIST.md](https://www.google.com/search?q=./SECURITY-AUDIT-CHECKLIST.md)** - Comprehensive security testing
  - **[ARCHITECTURE.md](https://www.google.com/search?q=./docs/ARCHITECTURE.md)** - System architecture deep-dive
  - **[API.md](https://www.google.com/search?q=./docs/API.md)** - IPC API documentation

-----

## 🧪 Testing

```bash
# Run all tests
npm test

# Security tests
npm run test:security

# Type checking
npm run type-check

# Linting
npm run lint

# Audit dependencies
npm run audit
```

-----

## 📦 Building for Distribution

### macOS

```bash
npm run build:mac
# Output: release/AirWork-1.0.0.dmg
# Requires: Apple Developer certificate for signing
```

### Windows

```bash
npm run build:win
# Output: release/AirWork-Setup-1.0.0.exe
# Requires: Code signing certificate (optional but recommended)
```

### Linux

```bash
npm run build:linux
# Output: 
#   release/AirWork-1.0.0.AppImage
#   release/AirWork-1.0.0.deb
#   release/AirWork-1.0.0.rpm
```

-----

## 🤝 How Collaboration Works

1.  **Two users on same LAN** start the app
2.  **P2P discovery** finds peers via multicast
3.  **Noise handshake** authenticates both peers
4.  **Safety number verification** (out-of-band, like Signal)
5.  **Trust peer** to enable collaboration
6.  **Share document** via encrypted invite link
7.  **Real-time sync** - Yjs handles conflict resolution
8.  **Offline edits** merge automatically when reconnected

-----

## 🔒 Privacy & Security Guarantees

### What We CAN'T See

  - ❌ Your password
  - ❌ Your documents
  - ❌ Your messages
  - ❌ Who you collaborate with
  - ❌ When you use the app

### What You Control

  - ✅ Your encryption keys
  - ✅ Your data (stored locally only)
  - ✅ Who you collaborate with
  - ✅ When to sync (manual or automatic)
  - ✅ Backup and export

### Zero Knowledge

We (the developers) have **zero knowledge** of your data. Even if we wanted to, we couldn't read your documents because:

1.  Everything is encrypted client-side
2.  We don't have your keys
3.  There are no servers to compromise
4.  P2P sync happens directly between devices

-----

## 🆚 Comparison with Alternatives

| Feature | AirWork | Notion | Google Docs | Obsidian | Signal |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **E2E Encrypted** | ✅ | ❌ | ❌ | ❌ | ✅ |
| **Offline-first** | ✅ | ⚠️ Limited | ❌ | ✅ | ⚠️ Limited |
| **No cloud required** | ✅ | ❌ | ❌ | ✅ | ❌ |
| **Real-time collab** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Open source** | ✅ | ❌ | ❌ | ⚠️ Partial | ✅ |
| **Zero knowledge** | ✅ | ❌ | ❌ | ✅ | ✅ |
| **Rich text editor** | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Project management** | ✅ | ✅ | ⚠️ Limited | ❌ | ❌ |

-----

## 🛠️ Technology Stack

### Frontend

  - **Next.js 14** - React framework
  - **TypeScript** - Type safety
  - **Tailwind CSS** - Styling
  - **Tiptap** - Rich text editor
  - **Lucide Icons** - UI icons

### Backend (Electron Main)

  - **Electron 28** - Desktop app framework
  - **TypeScript** - Type safety
  - **Signal Protocol** - E2E encryption (@signalapp/libsignal-client)
  - **Noise Protocol** - P2P authentication
  - **SQLCipher** - Encrypted database
  - **Yjs** - CRDT for collaboration
  - **sodium-native** - Cryptographic primitives

### Security

  - **Argon2id** - Password hashing
  - **XChaCha20-Poly1305** - Symmetric encryption
  - **Ed25519** - Digital signatures
  - **X25519** - Key agreement

-----

## 📝 Roadmap

### v1.0 (Current)

  - [x] Core encryption (Signal Protocol)
  - [x] P2P sync (Noise Protocol)
  - [x] Rich text editor
  - [x] Kanban boards
  - [x] Safety numbers
  - [x] Encrypted backups

### v1.1 (Planned)

  - [ ] File attachments (encrypted blobs)
  - [ ] Drawing/whiteboard
  - [ ] Search with encryption
  - [ ] Multiple device support
  - [ ] Mobile apps (React Native)

### v2.0 (Future)

  - [ ] Voice/video calls (WebRTC)
  - [ ] Calendar integration
  - [ ] Plugin system
  - [ ] Optional relay server (for non-LAN sync)
  - [ ] Web version (WASM)

-----

## Contributing

We welcome contributions\! Please see [CONTRIBUTING.md](https://www.google.com/search?q=./CONTRIBUTING.md) for guidelines.

### Security Contributions

If you find a security vulnerability:

1.  **DO NOT** open a public issue
2.  Email security@airwork.app
3.  We'll respond within 24 hours
4.  See [SECURITY.md](https://www.google.com/search?q=./SECURITY.md) for our responsible disclosure policy

-----

## 📜 License

MIT License - see [LICENSE](https://www.google.com/search?q=./LICENSE) file for details.

-----

## Acknowledgments

  - **Signal Foundation** - Signal Protocol implementation
  - **Yjs Team** - CRDT implementation
  - **Electron Team** - Desktop framework
  - **Next.js Team** - React framework
  - **SQLCipher** - Database encryption

-----

## 📞 Support

  - **Documentation**: [./docs](https://www.google.com/search?q=./docs)
  - **Bug Reports**: [GitHub Issues](https://www.google.com/search?q=https://github.com/yourusername/airwork/issues)
  - **Discussions**: [GitHub Discussions](https://www.google.com/search?q=https://github.com/yourusername/airwork/discussions)
  - **Security**: security@airwork.app

-----

## ⚠️ Disclaimer

This software is provided "as is" without warranty of any kind. While we've implemented industry-standard cryptography and security best practices, **no software is 100% secure**.

For highly sensitive data:

  - Use strong passwords (16+ characters)
  - Verify safety numbers with collaborators
  - Keep software updated
  - Create regular encrypted backups
  - Consider professional security audit

-----

## 🎉 Built With Love

Made with by developers who care about privacy and security.

**Star this repo** if you believe in privacy-first software\!
