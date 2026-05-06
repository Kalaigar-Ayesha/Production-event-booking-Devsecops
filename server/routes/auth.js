const express = require('express');
const router = express.Router();
const { register, login, verifyOTP } = require('../controllers/authController');
const rateLimit = require('express-rate-limit');
const { body } = require('express-validator');

const validate = (rules) => async (req, res, next) => {
  const { validationResult } = require('express-validator');
  await Promise.all(rules.map((r) => r.run(req)));
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: 'Validation error', errors: errors.array() });
  }
  return next();
};

// Stricter limiter for auth endpoints (brute-force mitigation)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});

router.post(
  '/register',
  authLimiter,
  validate([
    body('name').isString().trim().isLength({ min: 2, max: 80 }),
    body('email').isEmail().normalizeEmail(),
    body('password').isString().isLength({ min: 8, max: 128 }),
  ]),
  register
);

router.post(
  '/login',
  authLimiter,
  validate([body('email').isEmail().normalizeEmail(), body('password').isString().isLength({ min: 1, max: 128 })]),
  login
);

router.post(
  '/verify-otp',
  authLimiter,
  validate([body('email').isEmail().normalizeEmail(), body('otp').isString().trim().isLength({ min: 6, max: 6 })]),
  verifyOTP
);

module.exports = router;
