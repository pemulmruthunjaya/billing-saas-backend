const jwt = require("jsonwebtoken");

const WEAK_SECRETS = new Set([
  "secret",
  "secretkey",
  "jwtsecret",
  "changeme",
  "replace-with-a-long-random-secret",
]);

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;

  if (!secret || !secret.trim()) {
    throw new Error("JWT_SECRET is required");
  }

  if (WEAK_SECRETS.has(secret.trim().toLowerCase())) {
    throw new Error("JWT_SECRET must be changed before running the app");
  }

  if (secret.trim().length < 32) {
    throw new Error("JWT_SECRET must be at least 32 characters");
  }

  return secret;
};

const getJwtExpiry = () => process.env.JWT_EXPIRES_IN || "1d";

const signAuthToken = (payload) =>
  jwt.sign(payload, getJwtSecret(), { expiresIn: getJwtExpiry() });

const verifyAuthToken = (token) => jwt.verify(token, getJwtSecret());

module.exports = {
  getJwtExpiry,
  getJwtSecret,
  signAuthToken,
  verifyAuthToken,
};
