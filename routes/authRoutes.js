
// AUTH ROUTES

const express = require('express');
const { body } = require('express-validator');
const authController = require('../controllers/authController');

// express.Router() creates a mini standalone router 
const router = express.Router();

router.post(
  '/register',
  [
    body('username')
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Username must be between 2 and 100 characters.'),
    body('email').isEmail().withMessage('A valid email is required.').normalizeEmail(),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters long.')
  ],
  authController.register
);

router.post(
  '/login',
  [
    body('email').isEmail().withMessage('A valid email is required.').normalizeEmail(),
    body('password').notEmpty().withMessage('Password is required.')
  ],
  authController.login
);

module.exports = router;
