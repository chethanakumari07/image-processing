
// USER MODEL

const pool = require('../config/db');

/**
 * Insert a new user row. Returns the newly created user's ID.
 * @param {{username: string, email: string, passwordHash: string}} data
 */
async function createUser({ username, email, passwordHash }) {
 
  const [result] = await pool.execute(
    'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
    [username, email, passwordHash]
  );
  return result.insertId;
}

/**
 * Look up a user by email — used during login, and to check for
 * duplicate registrations.
 */
async function findUserByEmail(email) {
  const [rows] = await pool.execute(
    'SELECT id, username, email, password_hash, created_at FROM users WHERE email = ?',
    [email]
  );

  return rows[0];
}

async function findUserById(id) {
  const [rows] = await pool.execute(
    'SELECT id, username, email, created_at FROM users WHERE id = ?',
    [id]
  );
  return rows[0];
}

module.exports = { createUser, findUserByEmail, findUserById };
