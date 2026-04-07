/**
 * Auth middleware — requires an active session to access protected routes.
 */
function requireAuth(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) return next();
  return res.status(401).json({ error: 'Unauthorized' });
}

module.exports = { requireAuth };
