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

const passport = require('passport');

// Initiate Google OAuth flow
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// Google OAuth callback
router.get('/google/callback', 
    passport.authenticate('google', { failureRedirect: '/auth/login' }),
    (req, res) => {
        // Successful authentication, manually set session
        const user = req.user;
        req.session.user = {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role
        };
        
        const redirectUrl = (user.role === 'admin' || user.role === 'agent') ? '/admin/dashboard' : '/customer/dashboard';
        res.redirect(redirectUrl);
    }
);

// Initiate Facebook OAuth flow
router.get('/facebook', passport.authenticate('facebook', { scope: ['email'] }));

// Facebook OAuth callback
router.get('/facebook/callback', 
    passport.authenticate('facebook', { failureRedirect: '/auth/login' }),
    (req, res) => {
        // Successful authentication, manually set session
        const user = req.user;
        req.session.user = {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role
        };
        
        const redirectUrl = (user.role === 'admin' || user.role === 'agent') ? '/admin/dashboard' : '/customer/dashboard';
        res.redirect(redirectUrl);
    }
);

module.exports = router;
