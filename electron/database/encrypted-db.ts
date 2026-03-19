import Database from 'better-sqlite3-multiple-ciphers';
import * as path from 'path';
import * as fs from 'fs';
import { app } from 'electron';
import { INITIAL_SCHEMA } from './schema';
const sodium = require('sodium-native') as any;

export class EncryptedDatabase {
  private db: Database.Database | null = null;
  private dbPath: string;

  constructor(userId: string) {
    const userDataPath = app.getPath('userData');
    this.dbPath = path.join(userDataPath, `airwork_${userId}.db`);
  }

  // 1. Derives a 32-byte wrapping key from a secret (password or phrase)
  private deriveKey(secret: string, salt: Buffer): Buffer {
    const key = Buffer.alloc(32);
    const passBuf = Buffer.from(secret);

    sodium.crypto_pwhash(
      key,
      passBuf,
      salt,
      sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE,
      sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE,
      sodium.crypto_pwhash_ALG_ARGON2ID13
    );

    sodium.sodium_memzero(passBuf);
    return key;
  }

  // 2. Wraps the Vault Key inside a digital envelope
  private wrapKey(vaultKey: Buffer, wrappingKey: Buffer) {
    const nonce = Buffer.alloc(sodium.crypto_secretbox_NONCEBYTES);
    sodium.randombytes_buf(nonce);

    const cipher = Buffer.alloc(vaultKey.length + sodium.crypto_secretbox_MACBYTES);
    sodium.crypto_secretbox_easy(cipher, vaultKey, nonce, wrappingKey);

    return { nonce, cipher };
  }

  // 3. Unwraps the Vault Key from an envelope
  private unwrapKey(cipher: Buffer, nonce: Buffer, wrappingKey: Buffer): Buffer | null {
    const plain = Buffer.alloc(cipher.length - sodium.crypto_secretbox_MACBYTES);
    const success = sodium.crypto_secretbox_open_easy(plain, cipher, nonce, wrappingKey);

    if (!success) return null;
    return plain;
  }

  public async initialize(secret: string, isNewUser: boolean, recoveryPhrase?: string): Promise<boolean> {
    try {
      const keysPath = `${this.dbPath}.keys.json`;
      let vaultKey: any = Buffer.alloc(32);

      if (isNewUser) {
        // GENERATE: A completely random master key for the actual database
        sodium.randombytes_buf(vaultKey);

        // ENVELOPE 1: Lock with Password
        const pwdSalt = Buffer.alloc(sodium.crypto_pwhash_SALTBYTES);
        sodium.randombytes_buf(pwdSalt);
        const pwdKey = this.deriveKey(secret, pwdSalt);
        const pwdEnv = this.wrapKey(vaultKey, pwdKey);
        sodium.sodium_memzero(pwdKey);

        const keyData: any = {
          pwdSalt: pwdSalt.toString('hex'),
          pwdNonce: pwdEnv.nonce.toString('hex'),
          pwdWrapped: pwdEnv.cipher.toString('hex')
        };

        // ENVELOPE 2: Lock with Recovery Phrase
        if (recoveryPhrase) {
          const recSalt = Buffer.alloc(sodium.crypto_pwhash_SALTBYTES);
          sodium.randombytes_buf(recSalt);
          const recKey = this.deriveKey(recoveryPhrase, recSalt);
          const recEnv = this.wrapKey(vaultKey, recKey);
          sodium.sodium_memzero(recKey);

          keyData.recSalt = recSalt.toString('hex'),
          keyData.recNonce = recEnv.nonce.toString('hex'),
          keyData.recWrapped = recEnv.cipher.toString('hex')
        }

        fs.writeFileSync(keysPath, JSON.stringify(keyData, null, 2));
      } else {
        // LOAD ENVELOPES: Read the keys file
        if (!fs.existsSync(keysPath)) throw new Error('Security keys file missing');
        const keyData = JSON.parse(fs.readFileSync(keysPath, 'utf8'));

        // SMART DETECT: Is the user typing a password, or a 24-word phrase?
        const isRecovery = secret.trim().split(/\s+/).length === 24;

        if (isRecovery && keyData.recSalt) {
          const recKey = this.deriveKey(secret, Buffer.from(keyData.recSalt, 'hex'));
          const unwrapped = this.unwrapKey(
            Buffer.from(keyData.recWrapped, 'hex'),
            Buffer.from(keyData.recNonce, 'hex'),
            recKey
          );
          sodium.sodium_memzero(recKey);

          if (!unwrapped) throw new Error('Invalid Recovery Phrase');
          
          // Use the ! to tell TypeScript this is definitely not null
          vaultKey = unwrapped!; 
        } else {
          const pwdKey = this.deriveKey(secret, Buffer.from(keyData.pwdSalt, 'hex'));
          const unwrapped = this.unwrapKey(
            Buffer.from(keyData.pwdWrapped, 'hex'),
            Buffer.from(keyData.pwdNonce, 'hex'),
            pwdKey
          );
          sodium.sodium_memzero(pwdKey);

          if (!unwrapped) throw new Error('Invalid Password');
          
          // Use the ! here as well
          vaultKey = unwrapped!; 
        }
      }

      // Finalize: Open database with the unwrapped Vault Key
      const hexKey = vaultKey.toString('hex');
      this.db = new Database(this.dbPath);
      this.db.pragma(`key = "x'${hexKey}'"`);
      this.db.pragma('foreign_keys = ON');
      this.db.exec(INITIAL_SCHEMA);
      
      sodium.sodium_memzero(vaultKey);
      sodium.sodium_memzero(Buffer.from(hexKey));

      return true;
    } catch (error) {
      console.error('Database initialization failed:', error);
      this.close();
      return false;
    }
  }

  public getDb(): Database.Database {
    if (!this.db) throw new Error('Database not initialized');
    return this.db;
  }

  public close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}