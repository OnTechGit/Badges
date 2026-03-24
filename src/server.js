const app = require('./app');
const { port } = require('./config/env');
const { getPool } = require('./config/db');

async function start() {
  try {
    await getPool();
    console.log('Connected to SQL Server');

    app.listen(port, () => {
      console.log(`Server running on http://localhost:${port}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  }
}

start();
