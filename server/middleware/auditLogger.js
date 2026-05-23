const AuditLog = require('../models/AuditLog');

const sanitizeBody = (body = {}) => {
  const clone = { ...body };
  delete clone.password;
  delete clone.token;
  delete clone.smtpPass;
  return clone;
};

const auditLogger = ({ action, module, targetEntity, getTargetId } = {}) => {
  return async (req, res, next) => {
    const startMetadata = {
      method: req.method,
      path: req.originalUrl,
      body: sanitizeBody(req.body),
      query: req.query
    };

    res.on('finish', async () => {
      if (res.statusCode >= 400) return;
      try {
        await AuditLog.create({
          actorUserId: req.user?._id,
          actorRole: req.user?.role,
          action: action || req.method,
          module: module || 'GENERAL',
          targetEntity: targetEntity || null,
          targetId: typeof getTargetId === 'function' ? getTargetId(req, res) : req.params?.id || null,
          metadata: startMetadata
        });
      } catch (error) {
        console.error('Audit logging failed:', error.message);
      }
    });

    next();
  };
};

module.exports = { auditLogger };
