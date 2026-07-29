const express = require('express');
const router = express.Router();
const db = require('../../config/db');
const aiopEngine = require('../../engine/aiopEngine');
const { isAgentOrAdmin, isAdmin } = require('../../middlewares/auth');

// Apply agent/admin guard to all routes
router.use(isAgentOrAdmin);

// Admin / Agent Dashboard Overview
router.get('/dashboard', async (req, res) => {
    try {
        const agentId = req.session.user.id;

        // Fetch counts
        const [[{ totalCustomers }]] = await db.query('SELECT COUNT(*) as totalCustomers FROM users WHERE role = "customer"');
        const [[{ openTickets }]] = await db.query('SELECT COUNT(*) as openTickets FROM tickets WHERE status IN ("open", "in_progress")');
        const [[{ myOpenTickets }]] = await db.query('SELECT COUNT(*) as myOpenTickets FROM tickets WHERE status IN ("open", "in_progress") AND assigned_agent_id = ?', [agentId]);
        const [[{ totalConversations }]] = await db.query('SELECT COUNT(*) as totalConversations FROM conversations');

        // Fetch recent tickets
        const [recentTickets] = await db.query(`
            SELECT t.*, u.name as customer_name, a.name as agent_name 
            FROM tickets t
            JOIN conversations c ON t.conversation_id = c.id
            JOIN users u ON c.customer_id = u.id
            LEFT JOIN users a ON t.assigned_agent_id = a.id
            ORDER BY t.created_at DESC LIMIT 6
        `);

        res.render('admin/dashboard', {
            title: 'Admin Console',
            stats: { totalCustomers, openTickets, myOpenTickets, totalConversations },
            recentTickets
        });
    } catch (error) {
        console.error('Admin dashboard rendering page error:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Ticket Queue View (with filtering capabilities)
router.get('/tickets', async (req, res) => {
    try {
        const currentAgentId = req.session.user.id;
        const { status, category, priority, filter } = req.query;

        let queryStr = `
            SELECT t.*, u.name as customer_name, u.email as customer_email, a.name as agent_name 
            FROM tickets t
            JOIN conversations c ON t.conversation_id = c.id
            JOIN users u ON c.customer_id = u.id
            LEFT JOIN users a ON t.assigned_agent_id = a.id
            WHERE 1=1
        `;
        const queryParams = [];

        if (status) {
            queryStr += ' AND t.status = ?';
            queryParams.push(status);
        }
        if (category) {
            queryStr += ' AND t.category = ?';
            queryParams.push(category);
        }
        if (priority) {
            queryStr += ' AND t.priority = ?';
            queryParams.push(priority);
        }
        if (filter === 'me') {
            queryStr += ' AND t.assigned_agent_id = ?';
            queryParams.push(currentAgentId);
        } else if (filter === 'unassigned') {
            queryStr += ' AND t.assigned_agent_id IS NULL';
        }

        queryStr += ' ORDER BY t.created_at DESC';

        const [tickets] = await db.query(queryStr, queryParams);

        // Fetch all agents for potential reassignment
        const [agents] = await db.query('SELECT id, name FROM users WHERE role IN ("agent", "admin")');

        res.render('admin/tickets', {
            title: 'Ticket Queue',
            tickets,
            agents,
            filters: { status, category, priority, filter }
        });
    } catch (error) {
        console.error('Ticket queue page rendering error:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Single Ticket Conversation Monitor & Response Console
router.get('/ticket/:id', async (req, res) => {
    const ticketId = req.params.id;
    try {
        // Fetch ticket details
        const [tickets] = await db.query(
            `SELECT t.*, u.name as customer_name, u.id as customer_id, u.email as customer_email, a.name as agent_name
             FROM tickets t
             JOIN conversations c ON t.conversation_id = c.id
             JOIN users u ON c.customer_id = u.id
             LEFT JOIN users a ON t.assigned_agent_id = a.id
             WHERE t.id = ?`,
            [ticketId]
        );

        if (tickets.length === 0) {
            return res.status(404).send('Support Ticket not found.');
        }

        const ticket = tickets[0];

        // Fetch message logs for this conversation
        const [messages] = await db.query(
            'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC',
            [ticket.conversation_id]
        );

        // Fetch list of agents for reassignment
        const [agents] = await db.query('SELECT id, name FROM users WHERE role IN ("agent", "admin")');

        res.render('admin/chat-monitor', {
            title: `Manage Ticket #${ticket.id}`,
            ticket,
            messages,
            agents
        });
    } catch (error) {
        console.error('Ticket details screen rendering error:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Customer list and status management
router.get('/users', async (req, res) => {
    try {
        const [customers] = await db.query(`
            SELECT u.id, u.name, u.email, u.created_at, sa.kyc_status, sa.restriction_status, sa.balance 
            FROM users u
            LEFT JOIN simulated_accounts sa ON u.id = sa.customer_id
            WHERE u.role = 'customer'
            ORDER BY u.created_at DESC
        `);

        res.render('admin/users', {
            title: 'Customer Management',
            customers
        });
    } catch (error) {
        console.error('User management page error:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Analytics & NLP Training Center
router.get('/analytics', async (req, res) => {
    try {
        // Fetch NLP intents and count of utterances per intent
        const [intents] = await db.query(`
            SELECT i.id, i.tag, i.description, COUNT(u.id) as utterance_count
            FROM nlp_intents i
            LEFT JOIN nlp_utterances u ON i.id = u.intent_id
            GROUP BY i.id
        `);

        res.render('admin/reports', {
            title: 'Analytics & NLP Config',
            intents,
            isNLPCompiled: aiopEngine.getIsTrained()
        });
    } catch (error) {
        console.error('Analytics page error:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Trigger dynamic classifier retraining (Agent or Admin)
router.post('/nlp/retrain', async (req, res) => {
    try {
        const success = await aiopEngine.trainClassifier();
        if (success) {
            return res.status(200).json({ success: true, message: 'NLP classifier retrained successfully with current dataset.' });
        } else {
            return res.status(500).json({ success: false, error: 'Training failed. No utterances or database issue.' });
        }
    } catch (error) {
        console.error('NLP retrain error:', error);
        return res.status(500).json({ success: false, error: 'Internal training failure.' });
    }
});

// User Management: Agent Management (Admin Only)
router.get('/agents', isAdmin, async (req, res) => {
    try {
        const [agents] = await db.query(
            'SELECT id, name, email, created_at FROM users WHERE role = "agent" ORDER BY created_at DESC'
        );

        res.render('admin/agents', {
            title: 'Agent Management',
            agents
        });
    } catch (error) {
        console.error('Agent management page rendering error:', error);
        res.status(500).send('Internal Server Error');
    }
});

module.exports = router;
