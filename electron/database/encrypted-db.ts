import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import * as sodium from 'sodium-native';
import { app }  from 'electron';

export class EncryptedDatabase{
    private db: Database.Database | null = null;
    private dbPath: string;
    private masterkey:Buffer | null = null;

    constructor(userId: string) {
    const userDataPath = app.getPath('userData');
    this.dbPath = path.join(userDataPath, `airwork_${userId}.db`);
  }    
}

