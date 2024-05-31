const dbClient = require('./db');

async function getUserFromToken(token) {
  if (!token) return null;

  const user = await dbClient.collection('users').findOne({ token });
  return user;
}

module.exports = { getUserFromToken };
