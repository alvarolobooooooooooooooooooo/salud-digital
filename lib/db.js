// Re-export database connection from root db.js
const { query, pool } = require('../db');

module.exports = { query, pool };
