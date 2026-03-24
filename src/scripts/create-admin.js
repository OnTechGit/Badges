require('dotenv').config();
const bcrypt = require('bcryptjs');
const { getPool, sql } = require('../config/db');

const email = process.argv[2];
const password = process.argv[3];

if (!email || !password) {
  console.error('Usage: npm run create-admin -- <email> <password>');
  process.exit(1);
}

if (password.length < 8) {
  console.error('Password must be at least 8 characters');
  process.exit(1);
}

async function run() {
  try {
    const pool = await getPool();

    const existing = await pool
      .request()
      .input('email', sql.NVarChar(255), email)
      .query('SELECT id FROM admin_users WHERE email = @email');

    if (existing.recordset.length > 0) {
      console.error(`Admin with email "${email}" already exists.`);
      process.exit(1);
    }

    const hash = await bcrypt.hash(password, 10);

    const result = await pool
      .request()
      .input('email', sql.NVarChar(255), email)
      .input('hash', sql.NVarChar(255), hash)
      .query(`
        INSERT INTO admin_users (email, password_hash)
        OUTPUT INSERTED.id, INSERTED.email, INSERTED.created_at
        VALUES (@email, @hash)
      `);

    console.log('Admin created successfully:');
    console.log(`  ID:    ${result.recordset[0].id}`);
    console.log(`  Email: ${result.recordset[0].email}`);
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

run();
