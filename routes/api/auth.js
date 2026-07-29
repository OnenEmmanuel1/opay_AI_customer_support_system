const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const db = require('../../config/db');

// Handle customer registration
router.post('/register', async (req, res) => {
    const { name, email, password } = req.body;
    
    if (!name || !email || !password) {
        return res.status(400).json({ success: false, error: 'All fields are required.' });
    }

    try {
        // Check if email already exists
        const [existing] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        if (existing.length > 0) {
            return res.status(400).json({ success: false, error: 'Email is already registered.' });
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, 10);

        // Start transaction to insert user and create simulated account
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            const [result] = await connection.query(
                'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, "customer")',
                [name, email, passwordHash]
            );

            const customerId = result.insertId;

            // Create simulated account with a random balance and KYC tier 1
            const initialBalance = 1000.00; // default initial balance
            await connection.query(
                'INSERT INTO simulated_accounts (customer_id, kyc_status, restriction_status, balance) VALUES (?, "Tier 1", "Active", ?)',
                [customerId, initialBalance]
            );

            await connection.commit();

            // Set session
            req.session.user = {
                id: customerId,
                name: name,
                email: email,
                role: 'customer'
            };

            return res.status(201).json({ success: true, message: 'Registration successful', redirect: '/customer/dashboard' });
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Registration API Error:', error);
        return res.status(500).json({ success: false, error: 'Internal server error.' });
    }
});

// Handle login
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ success: false, error: 'Email and password are required.' });
    }

    try {
        const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        if (rows.length === 0) {
            return res.status(401).json({ success: false, error: 'Invalid email or password.' });
        }

        const user = rows[0];
        
        // Verify password
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ success: false, error: 'Invalid email or password.' });
        }

        // Verify account restriction if customer
        if (user.role === 'customer') {
            const [accounts] = await db.query('SELECT restriction_status FROM simulated_accounts WHERE customer_id = ?', [user.id]);
            if (accounts.length > 0 && accounts[0].restriction_status === 'Frozen') {
                return res.status(403).json({ success: false, error: 'Your account is frozen. Please contact administrator.' });
            }
        }

        // Set session
        req.session.user = {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role
        };

        const redirectUrl = (user.role === 'admin' || user.role === 'agent') ? '/admin/dashboard' : '/customer/dashboard';

        return res.status(200).json({ success: true, message: 'Login successful', redirect: redirectUrl });
    } catch (error) {
        console.error('Login API Error:', error);
        return res.status(500).json({ success: false, error: 'Internal server error.' });
    }
});

// Handle logout
router.post('/logout', (req, res) => {
    if (req.session) {
        req.session.destroy(err => {
            if (err) {
                return res.status(500).json({ success: false, error: 'Could not log out.' });
            }
            return res.status(200).json({ success: true, message: 'Logged out successfully', redirect: '/auth/login' });
        });
    } else {
        return res.status(200).json({ success: true, message: 'No active session' });
    }
});

module.exports = router;
