const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { loginUser, registerUser, setupPassword, checkToken, forgotPassword, resetPassword, refreshTokenController, logoutUser } = require('../controllers/authController');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  validate: { xForwardedForHeader: false },
  message: { message: 'Too many requests from this IP, please try again after 15 minutes' }
});

router.post('/login', authLimiter, loginUser);
router.post('/register', registerUser);
router.post('/setup-password/:token', setupPassword);
router.get('/check-token/:token', checkToken);
router.post('/forgot-password', authLimiter, forgotPassword);
router.post('/reset-password/:token', resetPassword);
router.post('/refresh-token', refreshTokenController);
router.post('/logout', logoutUser);

module.exports = router;




