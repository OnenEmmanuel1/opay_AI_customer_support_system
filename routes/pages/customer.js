const express = require('express');
const router = express.Router();
const db = require('../../config/db');
const { isCustomer } = require('../../middlewares/auth');

// Apply customer auth check
router.use(isCustomer);

// Customer Dashboard
router.get('/dashboard', async (req, res) => {
    const customerId = req.session.user.id;
    try {
        // Fetch simulated account details
        const [accounts] = await db.query(
            'SELECT * FROM simulated_accounts WHERE customer_id = ?',
            [customerId]
        );
        const account = accounts[0] || { balance: 0.00, kyc_status: 'Tier 1', restriction_status: 'Active' };

        // Fetch recent simulated transactions (limit 5)
        const [transactions] = await db.query(
            'SELECT * FROM simulated_transactions WHERE customer_id = ? ORDER BY created_at DESC LIMIT 5',
            [customerId]
        );

        // Fetch recent support tickets
        const [tickets] = await db.query(
            `SELECT t.*, u.name as agent_name 
             FROM tickets t
             JOIN conversations c ON t.conversation_id = c.id
             LEFT JOIN users u ON t.assigned_agent_id = u.id
             WHERE c.customer_id = ?
             ORDER BY t.created_at DESC LIMIT 5`,
            [customerId]
        );

        res.render('customer/dashboard', {
            title: 'Customer Dashboard',
            account,
            transactions,
            tickets
        });
    } catch (error) {
        console.error('Customer dashboard page error:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Chatbot Interface Page
router.get('/chat', (req, res) => {
    res.render('customer/chat', { title: 'Live AI Support' });
});

// Tickets Management Page
router.get('/tickets', async (req, res) => {
    const customerId = req.session.user.id;
    try {
        const [tickets] = await db.query(
            `SELECT t.*, u.name as agent_name 
             FROM tickets t
             JOIN conversations c ON t.conversation_id = c.id
             LEFT JOIN users u ON t.assigned_agent_id = u.id
             WHERE c.customer_id = ?
             ORDER BY t.created_at DESC`,
            [customerId]
        );

        res.render('customer/tickets', {
            title: 'My Support Tickets',
            tickets
        });
    } catch (error) {
        console.error('Customer tickets page error:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Transactions History Page
router.get('/transactions', async (req, res) => {
    const customerId = req.session.user.id;
    try {
        const [transactions] = await db.query(
            'SELECT * FROM simulated_transactions WHERE customer_id = ? ORDER BY created_at DESC',
            [customerId]
        );

        res.render('customer/transactions', {
            title: 'Simulated Transaction History',
            transactions
        });
    } catch (error) {
        console.error('Customer transactions page error:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Customer Profile Page
router.get('/profile', async (req, res) => {
    const customerId = req.session.user.id;
    try {
        const [accounts] = await db.query(
            'SELECT * FROM simulated_accounts WHERE customer_id = ?',
            [customerId]
        );
        const account = accounts[0] || { balance: 0.00, kyc_status: 'Tier 1', restriction_status: 'Active' };

        res.render('customer/profile', {
            title: 'My Profile',
            account
        });
    } catch (error) {
        console.error('Customer profile page error:', error);
        res.status(500).send('Internal Server Error');
    }
});

module.exports = router;
