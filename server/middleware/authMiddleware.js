const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;

  // Prefer Authorization header (works cross-domain and in incognito)
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies?.accessToken) {
    token = req.cookies.accessToken;
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select('-password');
      if (!req.user) {
        return res.status(401).json({ message: 'User not found' });
      }
      next();
    } catch (error) {
      res.status(401).json({ message: 'Not authorized, token failed' });
    }
  } else {
    res.status(401).json({ message: 'Not authorized, no token' });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (req.user && (req.user.role === 'SuperAdmin' || roles.includes(req.user.role))) {
      next();
    } else {
      res.status(403).json({ message: `Role ${req.user?.role || 'unknown'} is not authorized to access this route` });
    }
  };
};

const adminOnly = (req, res, next) => {
  if (req.user && ['Admin', 'SuperAdmin'].includes(req.user.role)) {
    next();
  } else {
    res.status(403).json({ message: 'Not authorized as an admin' });
  }
};

module.exports = { protect, adminOnly, authorize };

