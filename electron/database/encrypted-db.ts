import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import { app } from 'electron';
const sodium = require('sodium-native') as any;

export class EncryptedDatabase {
  private db: Database.Database | null = null;
  private dbPath: string;
  private masterKey: Buffer | null = null;

  constructor(userId: string) {
    const userDataPath = app.getPath('userData');
    this.dbPath = path.join(userDataPath, `securecollab_${userId}.db`);
  }

  

  private deriveKey(password: string, salt: Buffer): Buffer {
    const key = Buffer.alloc(32);
    const passBuf = Buffer.from(password);

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

  public async initialize(password: string, isNewUser: boolean): Promise<boolean> {
    try {
      let salt: Buffer;
      const saltPath = `${this.dbPath}.salt`;

      if (isNewUser) {
        salt = Buffer.alloc(sodium.crypto_pwhash_SALTBYTES);
        sodium.randombytes_buf(salt);
        fs.writeFileSync(saltPath, salt);
      } else {

        if (!fs.existsSync(saltPath)) throw new Error('User salt not found');
        salt = fs.readFileSync(saltPath);
      }

      this.masterKey = this.deriveKey(password, salt);
      const hexKey = this.masterKey.toString('hex');

      this.db = new Database(this.dbPath);
      this.db.pragma(`key = "x'${hexKey}'"`);
      this.db.exec('CREATE TABLE IF NOT EXISTS _health_check (id INTEGER PRIMARY KEY)');
      sodium.sodium_memzero(Buffer.from(hexKey));

      return true;
    } catch (error) {
      console.error('Database initialization failed:', error);
      this.close();
      return false;
    }
  }

  public close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }

    if (this.masterKey) {
      sodium.sodium_memzero(this.masterKey);
      this.masterKey = null;
    }
  }
}