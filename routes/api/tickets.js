const express = require('express');
const router = express.Router();
const db = require('../../config/db');
const aiopEngine = require('../../engine/aiopEngine');
const { isAuthenticated, isCustomer, isAgentOrAdmin } = require('../../middlewares/auth');

// Customer creates a ticket manually
router.post('/create', isCustomer, async (req, res) => {
    const customerId = req.session.user.id;
    const { category, priority, description } = req.body;

    if (!category || !description) {
        return res.status(400).json({ success: false, error: 'Category and description are required.' });
    }

    try {
        // Start transaction
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            // 1. Create a conversation for this ticket
            const [convResult] = await connection.query(
                'INSERT INTO conversations (customer_id) VALUES (?)',
                [customerId]
            );
            const conversationId = convResult.insertId;

            // 2. Save user message with the description
            await connection.query(
                'INSERT INTO messages (conversation_id, sender, content) VALUES (?, "user", ?)',
                [conversationId, description]
            );

            // 3. Find available agent using workload balancing
            const [agents] = await connection.query('SELECT id FROM users WHERE role IN ("agent", "admin")');
            let assignedAgentId = null;
            if (agents.length > 0) {
                const [workload] = await connection.query(`
                    SELECT assigned_agent_id, COUNT(*) as open_tickets 
                    FROM tickets 
                    WHERE status IN ("open", "in_progress") AND assigned_agent_id IS NOT NULL 
                    GROUP BY assigned_agent_id
                `);
                
                const workloadMap = {};
                agents.forEach(a => { workloadMap[a.id] = 0; });
                workload.forEach(w => { workloadMap[w.assigned_agent_id] = w.open_tickets; });
                
                let minWorkload = Infinity;
                agents.forEach(a => {
                    if (workloadMap[a.id] < minWorkload) {
                        minWorkload = workloadMap[a.id];
                        assignedAgentId = a.id;
                    }
                });
            }

            // 4. Create the ticket
            const [ticketResult] = await connection.query(
                'INSERT INTO tickets (conversation_id, category, priority, status, assigned_agent_id) VALUES (?, ?, ?, "open", ?)',
                [conversationId, category, priority || 'medium', assignedAgentId]
            );

            // 5. Save initial system message
            await connection.query(
                'INSERT INTO messages (conversation_id, sender, content, detected_intent, confidence_score) VALUES (?, "bot", ?, "create_ticket", 1.0000)',
                [conversationId, `Ticket #${ticketResult.insertId} created successfully. An agent has been assigned to help you.`]
            );

            await connection.commit();
            return res.status(201).json({ success: true, ticketId: ticketResult.insertId, redirect: '/customer/tickets' });
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Create ticket API error:', error);
        return res.status(500).json({ success: false, error: 'Failed to create support ticket.' });
    }
});

// Agent or Admin updates ticket status (lifecycle)
router.post('/status', isAgentOrAdmin, async (req, res) => {
    const { ticketId, status } = req.body;

    if (!ticketId || !status) {
        return res.status(400).json({ success: false, error: 'ticketId and status are required.' });
    }

    const validStatuses = ['open', 'in_progress', 'resolved', 'closed'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ success: false, error: 'Invalid status value.' });
    }

    try {
        if (status === 'resolved' || status === 'closed') {
            await db.query(
                'UPDATE tickets SET status = ?, resolved_at = CURRENT_TIMESTAMP WHERE id = ?',
                [status, ticketId]
            );
        } else {
            await db.query(
                'UPDATE tickets SET status = ?, resolved_at = NULL WHERE id = ?',
                [status, ticketId]
            );
        }

        // Fetch ticket's conversation ID to log agent's state-change message
        const [tickets] = await db.query('SELECT conversation_id FROM tickets WHERE id = ?', [ticketId]);
        if (tickets.length > 0) {
            const conversationId = tickets[0].conversation_id;
            await db.query(
                'INSERT INTO messages (conversation_id, sender, content) VALUES (?, "bot", ?)',
                [conversationId, `Ticket status has been updated to: ${status.toUpperCase().replace('_', ' ')}.`]
            );
        }

        return res.status(200).json({ success: true, message: 'Ticket status updated successfully.' });
    } catch (error) {
        console.error('Update ticket status API error:', error);
        return res.status(500).json({ success: false, error: 'Failed to update ticket status.' });
    }
});

// Admin or Agent reassigns a ticket
router.post('/reassign', isAgentOrAdmin, async (req, res) => {
    const { ticketId, agentId } = req.body;

    if (!ticketId || !agentId) {
        return res.status(400).json({ success: false, error: 'ticketId and agentId are required.' });
    }

    try {
        // Verify agent exists and has correct role
        const [agents] = await db.query('SELECT id, name FROM users WHERE id = ? AND role IN ("agent", "admin")', [agentId]);
        if (agents.length === 0) {
            return res.status(404).json({ success: false, error: 'Agent not found.' });
        }

        await db.query(
            'UPDATE tickets SET assigned_agent_id = ? WHERE id = ?',
            [agentId, ticketId]
        );

        // Log agent reassignment to the chat transcript
        const [tickets] = await db.query('SELECT conversation_id FROM tickets WHERE id = ?', [ticketId]);
        if (tickets.length > 0) {
            const conversationId = tickets[0].conversation_id;
            await db.query(
                'INSERT INTO messages (conversation_id, sender, content) VALUES (?, "bot", ?)',
                [conversationId, `Ticket reassigned to agent: ${agents[0].name}.`]
            );
        }

        return res.status(200).json({ success: true, message: `Ticket reassigned to ${agents[0].name}.` });
    } catch (error) {
        console.error('Reassign ticket API error:', error);
        return res.status(500).json({ success: false, error: 'Failed to reassign ticket.' });
    }
});

// Support Agent or Admin sends a message reply to the ticket/conversation
router.post('/reply', isAgentOrAdmin, async (req, res) => {
    const { conversationId, content } = req.body;
    const senderName = req.session.user.name;

    if (!conversationId || !content || content.trim() === '') {
        return res.status(400).json({ success: false, error: 'Conversation ID and message content are required.' });
    }

    try {
        // 1. Insert message
        const [result] = await db.query(
            'INSERT INTO messages (conversation_id, sender, content) VALUES (?, "agent", ?)',
            [conversationId, content]
        );

        // 2. Automatically advance ticket status to 'in_progress' if it was 'open'
        const [tickets] = await db.query('SELECT id, status FROM tickets WHERE conversation_id = ?', [conversationId]);
        if (tickets.length > 0 && tickets[0].status === 'open') {
            await db.query('UPDATE tickets SET status = "in_progress" WHERE id = ?', [tickets[0].id]);
        }

        return res.status(200).json({
            success: true,
            message: 'Reply sent successfully.',
            reply: {
                id: result.insertId,
                sender: 'agent',
                senderName,
                content,
                created_at: new Date()
            }
        });
    } catch (error) {
        console.error('Agent ticket reply API error:', error);
        return res.status(500).json({ success: false, error: 'Failed to send reply.' });
    }
});

module.exports = router;
