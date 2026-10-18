import bcrypt from 'bcryptjs';
import { createClient } from '@libsql/client';
import path from 'path';
import fs from 'fs';

function resolveDbUrl(): string {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }
  if (process.env.DATABASE_PATH) {
    const p = process.env.DATABASE_PATH.replace(/\\/g, '/');
    return `file:${p}`;
  }
  if (process.platform !== 'win32' && fs.existsSync('/app/data')) {
    return 'file:/app/data/pickem.db';
  }
  const localPath = path.join(process.cwd(), 'data', 'pickem.db').replace(/\\/g, '/');
  return `file:${localPath}`;
}

async function main() {
  const args = process.argv.slice(2);
  const username = args[0];
  const newPassword = args[1];

  if (!username || !newPassword) {
    console.error('\nUsage: npm run reset-password -- <username> <new_password>');
    console.error('Example: npm run reset-password -- admin myNewSecurePass123\n');
    process.exit(1);
  }

  const dbUrl = resolveDbUrl();
  const client = createClient({ url: dbUrl });

  const result = await client.execute({
    sql: 'SELECT id, username FROM users WHERE lower(username) = lower(?)',
    args: [username],
  });

  if (result.rows.length === 0) {
    console.error(`User "${username}" was not found in the database.`);
    process.exit(1);
  }

  const user = result.rows[0];
  const newHash = bcrypt.hashSync(newPassword, 10);

  await client.execute({
    sql: 'UPDATE users SET password_hash = ? WHERE id = ?',
    args: [newHash, user.id],
  });

  console.log(`\nSUCCESS: Password for user "${user.username}" (ID: ${user.id}) has been reset successfully!\n`);
}

main().catch((err) => {
  console.error('Reset password error:', err);
  process.exit(1);
});
