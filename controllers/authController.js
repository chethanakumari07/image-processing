// AUTH CONTROLLER
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');

const userModel = require('../models/userModel');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');

/**
 * Creates a JWT for a given user. The payload (the data encoded
 */
function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

// POST /api/auth/register
const register = catchAsync(async (req, res) => {
  // express-validator (wired up in routes/authRoutes.js) has already
  // checked username/email/password format. validationResult() reads
  // whatever errors it found and attaches them to req.
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new AppError(errors.array()[0].msg, 400);
  }

  const { username, email, password } = req.body;

  // Reject duplicate emails with a friendly message 
  const existing = await userModel.findUserByEmail(email);
  if (existing) {
    throw new AppError('An account with that email already exists.', 409);
  }

  // bcrypt.hash(password, saltRounds): saltRounds controls 
  const passwordHash = await bcrypt.hash(password, 12);

  const userId = await userModel.createUser({ username, email, passwordHash });
  const user = { id: userId, username, email };

  const token = signToken(user);

  // the correct status code for a successful resource-creation request like sign-up.
  res.status(201).json({ status: 'success', user, token });
});

// POST /api/auth/login
const login = catchAsync(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new AppError(errors.array()[0].msg, 400);
  }

  const { email, password } = req.body;

  const userRow = await userModel.findUserByEmail(email);

  // IMPORTANT: we give the SAME error message 
  if (!userRow) {
    throw new AppError('Incorrect email or password.', 401);
  }

  // bcrypt.compare re-hashes the submitted password 
  const passwordMatches = await bcrypt.compare(password, userRow.password_hash);
  if (!passwordMatches) {
    throw new AppError('Incorrect email or password.', 401);
  }

  const user = { id: userRow.id, username: userRow.username, email: userRow.email };
  const token = signToken(user);

  res.status(200).json({ status: 'success', user, token });
});

module.exports = { register, login };
