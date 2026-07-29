// Authentication Middlewares for OpaySupportAI

module.exports = {
    isAuthenticated: (req, res, next) => {
        if (req.session && req.session.user) {
            return next();
        }
        res.redirect('/auth/login');
    },
    
    isCustomer: (req, res, next) => {
        if (req.session && req.session.user && req.session.user.role === 'customer') {
            return next();
        }
        res.redirect('/auth/login');
    },

    isAgentOrAdmin: (req, res, next) => {
        if (req.session && req.session.user && (req.session.user.role === 'agent' || req.session.user.role === 'admin')) {
            return next();
        }
        res.status(403).send('Access Denied: Support Agents or Administrators Only.');
    },

    isAdmin: (req, res, next) => {
        if (req.session && req.session.user && req.session.user.role === 'admin') {
            return next();
        }
        res.status(403).send('Access Denied: Administrators Only.');
    }
};
