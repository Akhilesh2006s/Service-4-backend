// Authentication middleware
// This checks if user is logged in via session

const requireAuth = (req, res, next) => {
  if (req.session && req.session.user) {
    req.user = req.session.user;
    return next();
  }
  return res.status(401).json({ error: 'Authentication required' });
};

const requireAdmin = (req, res, next) => {
  if (req.session && req.session.user) {
    const userType = req.session.user.userType;
    if (userType === 'super_admin' || userType === 'admin') {
      req.user = req.session.user;
      return next();
    }
  }
  return res.status(403).json({ error: 'Admin access required' });
};

const requireSuperAdmin = (req, res, next) => {
  if (req.session && req.session.user && req.session.user.userType === 'super_admin') {
    req.user = req.session.user;
    return next();
  }
  return res.status(403).json({ error: 'Super admin access required' });
};

const requireCustomer = (req, res, next) => {
  if (req.session && req.session.user && req.session.user.userType === 'customer') {
    req.user = req.session.user;
    return next();
  }
  return res.status(403).json({ error: 'Customer access required' });
};

module.exports = {
  requireAuth,
  requireAdmin,
  requireSuperAdmin,
  requireCustomer
};




