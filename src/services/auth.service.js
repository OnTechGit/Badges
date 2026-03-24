const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const authModel = require('../models/auth.model');
const { nodeEnv } = require('../config/env');

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';

async function login(email, password) {
  if (!email || !password) {
    const err = new Error('email and password are required');
    err.status = 400;
    throw err;
  }

  const user = await authModel.findByEmail(email);
  if (!user) {
    const err = new Error('Invalid credentials');
    err.status = 401;
    throw err;
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    const err = new Error('Invalid credentials');
    err.status = 401;
    throw err;
  }

  const token = jwt.sign(
    { sub: user.id, email: user.email },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );

  return { token, expiresIn: JWT_EXPIRES_IN };
}

async function getAll() {
  return authModel.findAll();
}

async function remove(id, currentUserId) {
  if (id === currentUserId) {
    const err = new Error('Cannot delete your own account');
    err.status = 400;
    throw err;
  }

  const deleted = await authModel.remove(id);
  if (!deleted) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }
  return deleted;
}

async function register(email, password) {
  if (!email || !password) {
    const err = new Error('email and password are required');
    err.status = 400;
    throw err;
  }

  if (password.length < 8) {
    const err = new Error('password must be at least 8 characters');
    err.status = 400;
    throw err;
  }

  const existing = await authModel.findByEmail(email);
  if (existing) {
    const err = new Error('Email already registered');
    err.status = 409;
    throw err;
  }

  const password_hash = await bcrypt.hash(password, 10);
  return authModel.create({ email, password_hash });
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

module.exports = { login, register, verifyToken, getAll, remove };
