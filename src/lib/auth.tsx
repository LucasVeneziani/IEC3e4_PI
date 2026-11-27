import * as Crypto from 'expo-crypto';
import { useSQLiteContext } from 'expo-sqlite';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { bytesToBase64 } from './base64';
import { getKv, setKv } from './db';
import { EMAIL_REGEX, STRONG_PASSWORD_REGEX, USERNAME_REGEX } from './validation';

export type User = { id: number; username: string; email: string };

type AuthContextValue = {
  user: User | null;
  ready: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const SESSION_KEY = 'session_user_id';
const PBKDF_ROUNDS = 300;

/** SHA-256 com salt e várias iterações. As contas ficam só neste aparelho; o objetivo é não guardar a senha em texto puro. */
async function hashPassword(password: string, salt: string): Promise<string> {
  let hash = `${salt}:${password}`;
  for (let i = 0; i < PBKDF_ROUNDS; i++) {
    hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}${hash}`);
  }
  return hash;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const db = useSQLiteContext();
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const id = await getKv(db, SESSION_KEY);
      if (id) {
        const row = await db.getFirstAsync<User>('SELECT id, username, email FROM users WHERE id = ?', Number(id));
        setUser(row ?? null);
      }
      setReady(true);
    })();
  }, [db]);

  const login = useCallback(
    async (username: string, password: string) => {
      const row = await db.getFirstAsync<User & { password_hash: string; salt: string }>(
        'SELECT id, username, email, password_hash, salt FROM users WHERE username = ? OR email = ?',
        username.trim(),
        username.trim(),
      );
      if (!row || (await hashPassword(password, row.salt)) !== row.password_hash) {
        throw new Error('Usuário ou senha incorretos.');
      }
      await setKv(db, SESSION_KEY, String(row.id));
      setUser({ id: row.id, username: row.username, email: row.email });
    },
    [db],
  );

  const register = useCallback(
    async (username: string, email: string, password: string) => {
      const u = username.trim();
      const e = email.trim().toLowerCase();
      if (!USERNAME_REGEX.test(u)) throw new Error('Usuário deve ter 3 a 20 letras, números, "." ou "_".');
      if (!EMAIL_REGEX.test(e)) throw new Error('E-mail inválido.');
      if (!STRONG_PASSWORD_REGEX.test(password)) throw new Error('A senha não atende aos requisitos.');
      const exists = await db.getFirstAsync('SELECT id FROM users WHERE username = ? OR email = ?', u, e);
      if (exists) throw new Error('Usuário ou e-mail já cadastrado.');

      const salt = bytesToBase64(Crypto.getRandomBytes(16));
      const hash = await hashPassword(password, salt);
      const result = await db.runAsync(
        'INSERT INTO users (username, email, password_hash, salt, created_at) VALUES (?, ?, ?, ?, ?)',
        u,
        e,
        hash,
        salt,
        Date.now(),
      );
      const id = result.lastInsertRowId;
      await setKv(db, SESSION_KEY, String(id));
      setUser({ id, username: u, email: e });
    },
    [db],
  );

  const logout = useCallback(async () => {
    await setKv(db, SESSION_KEY, null);
    setUser(null);
  }, [db]);

  const value = useMemo(() => ({ user, ready, login, register, logout }), [user, ready, login, register, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
