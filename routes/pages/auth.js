const express = require('express');
const router = express.Router();

// Redirect helper
const redirectIfSessionActive = (req, res, next) => {
    if (req.session && req.session.user) {
        if (req.session.user.role === 'admin' || req.session.user.role === 'agent') {
            return res.redirect('/admin/dashboard');
        } else {
            return res.redirect('/customer/dashboard');
        }
    }
    next();
};

// Render Login Page
router.get('/login', redirectIfSessionActive, (req, res) => {
    res.render('auth/login', { title: 'Sign In', error: null });
});

// Render Register Page
router.get('/register', redirectIfSessionActive, (req, res) => {
    res.render('auth/register', { title: 'Create Account', error: null });
});

// Logout handles redirection after destroying session
router.get('/logout', (req, res) => {
    if (req.session) {
        req.session.destroy(() => {
            res.redirect('/auth/login');
        });
    } else {
        res.redirect('/auth/login');
    }
});

module.exports = router;
