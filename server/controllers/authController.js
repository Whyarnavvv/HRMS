const User = require('../models/User');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const generateAccessToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET, { expiresIn: '15m' });
};

const generateRefreshToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET, { expiresIn: '7d' });
};

// @desc    Register a new user (Stage 1: Email only)
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res) => {
  const { name, email } = req.body;

  try {
    const userExists = await User.findOne({ email });

    if (userExists) {
      if (userExists.isEmailVerified && userExists.password !== 'PENDING_VERIFICATION') {
        return res.status(400).json({ message: 'Email already registered and verified. Please log in.' });
      }
      // If user exists but unverified, we re-send email
      var user = userExists;
    } else {
      // Generate random dummy password for initial creation
      const dummyPassword = crypto.randomBytes(16).toString('hex');

      var user = await User.create({
        name,
        email,
        password: dummyPassword,
        role: 'Employee',
        isEmailVerified: false,
        kycStatus: 'Incomplete'
      });
    }

    // Generate/Update Verification Token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    user.emailVerificationToken = verificationToken;
    user.emailVerificationTokenExpire = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
    await user.save();

    if (user) {
      // Send Verification Email
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: process.env.SMTP_PORT || 587,
        secure: false, // true for 465, false for other ports
        auth: {
          user: process.env.SMTP_USER || process.env.EMAIL_USER,
          pass: process.env.SMTP_PASS || process.env.EMAIL_PASS
        }
      });

      const url = `http://192.168.1.5:5173/setup-password/${verificationToken}`;
      const senderEmail = process.env.SMTP_USER || process.env.EMAIL_USER;

      const mailOptions = {
        from: `"Study Palace Hub" <${senderEmail}>`,
        to: email,
        subject: 'Action Required: Set Up Your HRMS Account',
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
            <h2 style="color: #2563eb;">Welcome to Study Palace Hub</h2>
            <p>Hello ${name},</p>
            <p>Your account has been initiated. Please click the button below to verify your email and set your password:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${url}" style="background: #2563eb; color: white; padding: 12px 25px; text-decoration: none; border-radius: 8px; font-weight: bold;">Set Up Password</a>
            </div>
            <p>If the button doesn't work, copy and paste this link:</p>
            <p style="color: #64748b; font-size: 0.9em;">${url}</p>
            <p><em>This link will expire in 24 hours.</em></p>
          </div>
        `
      };

      try {
        if (!senderEmail || (!process.env.SMTP_PASS && !process.env.EMAIL_PASS)) {
          console.log(`\n📧 [SIMULATION] Verification & Password Setup link for ${email}: ${url}\n`);
        } else {
          await transporter.sendMail(mailOptions);
          console.log(`✅ Registration email sent successfully to: ${email}`);
        }
      } catch (mailError) {
        console.error('❌ Failed to send registration email:', mailError.message);
        // We still return 201 because the user was created, but we log the error
      }

      res.status(201).json({
        message: 'Account initiated. Please check your email to set your password.',
        email: user.email
      });

    } else {
      res.status(400).json({ message: 'Invalid user data' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Set Password and Verify Email
// @route   POST /api/auth/setup-password/:token
// @access  Public
const setupPassword = async (req, res) => {
  const { password } = req.body;
  const { token } = req.params;

  try {
    const user = await User.findOne({ 
      emailVerificationToken: token,
      emailVerificationTokenExpire: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired setup token' });
    }

    user.password = password;
    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationTokenExpire = undefined;
    await user.save();

    res.status(200).json({
      message: 'Password set successfully. You can now log in and complete your KYC.',
      success: true
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Verify Token Validity (Helper for frontend)
// @route   GET /api/auth/check-token/:token
// @access  Public
const checkToken = async (req, res) => {
  try {
    const user = await User.findOne({ emailVerificationToken: req.params.token });
    if (!user) return res.status(400).json({ valid: false });
    res.status(200).json({ valid: true, name: user.name, email: user.email });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Block inactive (deactivated) accounts
    if (user.isActive === 'Inactive') {
      return res.status(403).json({ message: 'Your account has been deactivated. Please contact HR.' });
    }

    // Check Verification Status
    if (!user.isEmailVerified) {
      return res.status(403).json({
        message: 'Please verify your email address before logging in.',
        unverified: true
      });
    }

    // Helper function to set cookies
    const setTokenCookies = async (userDoc) => {
      const accessToken = generateAccessToken(userDoc._id);
      const refreshToken = generateRefreshToken(userDoc._id);

      userDoc.refreshToken = refreshToken;
      await userDoc.save({ validateBeforeSave: false });

      const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
      };

      res.cookie('accessToken', accessToken, { ...cookieOptions, maxAge: 15 * 60 * 1000 }); // 15 minutes
      res.cookie('refreshToken', refreshToken, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 }); // 7 days
    };

    // Check KYC Status - We allow login for all statuses, let frontend route accordingly
    if (user.kycStatus === 'Incomplete' || user.kycStatus === 'Rejected') {
      await setTokenCookies(user);
      return res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department || null,
        designation: user.designation || null,
        employeeId: user.employeeId || null,
        totalKpi: user.totalKpi || 0,
        kycStatus: user.kycStatus,
        message: user.kycStatus === 'Incomplete'
          ? 'Please complete your profile details for verification.'
          : 'Your KYC was rejected. Please update your details and re-submit.'
      });
    }

    if (user.kycStatus === 'Pending' && user.role === 'Employee') {
      await setTokenCookies(user);
      return res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department || null,
        designation: user.designation || null,
        employeeId: user.employeeId || null,
        totalKpi: user.totalKpi || 0,
        kycStatus: 'Pending',
        message: 'Your account is under review. Please wait for HR approval.'
      });
    }

    await setTokenCookies(user);
    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department || null,
      designation: user.designation || null,
      employeeId: user.employeeId || null,
      totalKpi: user.totalKpi || 0,
      kycStatus: user.kycStatus
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Forgot Password
// @route   POST /api/auth/forgot-password
// @access  Public
const forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: 'There is no user with that email' });
    }

    // Get reset token
    const resetToken = user.getResetPasswordToken();

    await user.save({ validateBeforeSave: false });

    // Create reset url
    const resetUrl = `http://192.168.1.5:5173/reset-password/${resetToken}`;

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: process.env.SMTP_PORT || 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER || process.env.EMAIL_USER,
        pass: process.env.SMTP_PASS || process.env.EMAIL_PASS
      }
    });

    const senderEmail = process.env.SMTP_USER || process.env.EMAIL_USER;

    const message = `
      <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #2563eb;">Password Reset Required</h2>
        <p>Hello ${user.name},</p>
        <p>You are receiving this email because you (or someone else) has requested the reset of a password. Please make a PUT request to:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" style="background: #2563eb; color: white; padding: 12px 25px; text-decoration: none; border-radius: 8px; font-weight: bold;">Reset Password</a>
        </div>
        <p>If the button doesn't work, copy and paste this link:</p>
        <p style="color: #64748b; font-size: 0.9em;">${resetUrl}</p>
        <p><em>This link will expire in 15 minutes.</em></p>
      </div>
    `;

    try {
      if (!senderEmail || (!process.env.SMTP_PASS && !process.env.EMAIL_PASS)) {
        console.log(`\n📧 [SIMULATION] Password Reset link for ${email}: ${resetUrl}\n`);
      } else {
        await transporter.sendMail({
          from: `"Study Palace Hub" <${senderEmail}>`,
          to: user.email,
          subject: 'Password Reset Token',
          html: message
        });
        console.log(`✅ Password reset email sent successfully to: ${email}`);
      }
      res.status(200).json({ success: true, data: 'Email sent' });
    } catch (err) {
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;

      await user.save({ validateBeforeSave: false });

      console.error('❌ Failed to send password reset email:', err.message);
      return res.status(500).json({ message: 'Email could not be sent' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Reset Password
// @route   POST /api/auth/reset-password/:token
// @access  Public
const resetPassword = async (req, res) => {
  try {
    // Get hashed token
    const resetPasswordToken = crypto
      .createHash('sha256')
      .update(req.params.token)
      .digest('hex');

    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid token or token expired' });
    }

    // Set new password
    user.password = req.body.password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password reset successful'
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Refresh Token
// @route   POST /api/auth/refresh-token
// @access  Public
const refreshTokenController = async (req, res) => {
  const refreshToken = req.cookies.refreshToken;

  if (!refreshToken) {
    return res.status(401).json({ message: 'Not authorized, no refresh token' });
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);
    
    const user = await User.findById(decoded.id);

    if (!user || user.refreshToken !== refreshToken) {
      return res.status(403).json({ message: 'Invalid refresh token' });
    }

    // Generate new tokens (rotation)
    const newAccessToken = generateAccessToken(user._id);
    const newRefreshToken = generateRefreshToken(user._id);

    user.refreshToken = newRefreshToken;
    await user.save({ validateBeforeSave: false });

    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    };

    res.cookie('accessToken', newAccessToken, { ...cookieOptions, maxAge: 15 * 60 * 1000 }); // 15 minutes
    res.cookie('refreshToken', newRefreshToken, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 }); // 7 days

    res.status(200).json({ message: 'Token refreshed successfully' });
  } catch (error) {
    res.status(403).json({ message: 'Invalid refresh token or expired' });
  }
};

// @desc    Logout User
// @route   POST /api/auth/logout
// @access  Public
const logoutUser = async (req, res) => {
  const refreshToken = req.cookies.refreshToken;
  
  if (refreshToken) {
    try {
      const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);
      const user = await User.findById(decoded.id);
      if (user) {
        user.refreshToken = undefined;
        await user.save({ validateBeforeSave: false });
      }
    } catch (error) {
      // Ignore token verification error on logout
    }
  }

  res.clearCookie('accessToken', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax' });
  res.clearCookie('refreshToken', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax' });

  res.status(200).json({ message: 'Logged out successfully' });
};

module.exports = { loginUser, registerUser, setupPassword, checkToken, forgotPassword, resetPassword, refreshTokenController, logoutUser };

