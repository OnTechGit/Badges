const sql = require('mssql');
const { db } = require('./env');

const config = {
  server: db.host,
  port: db.port,
  user: db.user,
  password: db.password,
  database: db.database,
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
};

let pool;

async function getPool() {
  if (!pool) {
    pool = await sql.connect(config);
  }
  return pool;
}

module.exports = { sql, getPool };
