// DATABASE CONNECTION

const mysql = require('mysql2/promise');

// process.env holds every variable from your .env file (dotenv loads
// them in server.js, before this file is required).
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

module.exports = pool;
