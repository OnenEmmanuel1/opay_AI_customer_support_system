const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const db = require('../../config/db');
const { isAdmin, isAgentOrAdmin } = require('../../middlewares/auth');

// Create a support agent account (Admin only)
router.post('/agents/create', isAdmin, async (req, res) => {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({ success: false, error: 'All fields are required.' });
    }

    try {
        const [existing] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        if (existing.length > 0) {
            return res.status(400).json({ success: false, error: 'Email is already registered.' });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        await db.query(
            'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, "agent")',
            [name, email, passwordHash]
        );

        return res.status(201).json({ success: true, message: 'Agent account created successfully.' });
    } catch (error) {
        console.error('Create agent API error:', error);
        return res.status(500).json({ success: false, error: 'Failed to create agent account.' });
    }
});

// Update customer simulated account restriction (Agent or Admin)
router.post('/customer/status', isAgentOrAdmin, async (req, res) => {
    const { customerId, restrictionStatus, kycStatus } = req.body;

    if (!customerId) {
        return res.status(400).json({ success: false, error: 'Customer ID is required.' });
    }

    try {
        const updates = [];
        const params = [];

        if (restrictionStatus) {
            updates.push('restriction_status = ?');
            params.push(restrictionStatus);
        }
        if (kycStatus) {
            updates.push('kyc_status = ?');
            params.push(kycStatus);
        }

        if (updates.length === 0) {
            return res.status(400).json({ success: false, error: 'No update parameters provided.' });
        }

        params.push(customerId);

        await db.query(
            `UPDATE simulated_accounts SET ${updates.join(', ')} WHERE customer_id = ?`,
            params
        );

        return res.status(200).json({ success: true, message: 'Customer account status updated successfully.' });
    } catch (error) {
        console.error('Update customer status API error:', error);
        return res.status(500).json({ success: false, error: 'Failed to update customer status.' });
    }
});

// Compile analytics metrics (Agent or Admin)
router.get('/analytics', isAgentOrAdmin, async (req, res) => {
    try {
        // 1. Average Ticket Resolution Time (in hours)
        const [[resTimeRow]] = await db.query(`
            SELECT AVG(TIMESTAMPDIFF(MINUTE, created_at, resolved_at)) as avg_res_minutes 
            FROM tickets 
            WHERE resolved_at IS NOT NULL
        `);
        
        let avgResolutionMinutes = parseFloat(resTimeRow.avg_res_minutes || 0);
        let avgResolutionFormatted = avgResolutionMinutes > 0 
            ? `${(avgResolutionMinutes / 60).toFixed(1)} hours` 
            : 'N/A';

        // 2. Resolution Rate
        const [[ticketStats]] = await db.query(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status IN ('resolved', 'closed') THEN 1 ELSE 0 END) as resolved
            FROM tickets
        `);
        
        let totalTickets = ticketStats.total || 0;
        let resolvedTickets = ticketStats.resolved || 0;
        let resolutionRate = totalTickets > 0 
            ? parseFloat(((resolvedTickets / totalTickets) * 100).toFixed(1)) 
            : 0.0;

        // 3. Intent Detection Accuracy & Confidence Distribution
        const [intentBreakdown] = await db.query(`
            SELECT 
                detected_intent as intent,
                COUNT(*) as volume,
                AVG(confidence_score) as avg_confidence
            FROM messages
            WHERE sender = 'bot' AND detected_intent IS NOT NULL
            GROUP BY detected_intent
        `);

        const formattedIntentDistribution = intentBreakdown.map(i => ({
            intent: i.intent,
            volume: i.volume,
            avgConfidence: parseFloat((i.avg_confidence * 100).toFixed(1))
        }));

        // 4. Ticket Volume by Category
        const [categoryBreakdown] = await db.query(`
            SELECT category, COUNT(*) as volume 
            FROM tickets 
            GROUP BY category
        `);

        // 5. General stats
        const [[statsRow]] = await db.query(`
            SELECT 
                (SELECT COUNT(*) FROM users WHERE role = 'customer') as total_customers,
                (SELECT COUNT(*) FROM tickets WHERE status = 'open') as open_tickets,
                (SELECT COUNT(*) FROM messages) as total_messages
        `);

        return res.status(200).json({
            success: true,
            metrics: {
                avgResolutionTime: avgResolutionFormatted,
                resolutionRate: `${resolutionRate}%`,
                intentAccuracy: formattedIntentDistribution,
                ticketCategoryVolume: categoryBreakdown,
                generalStats: statsRow
            }
        });
    } catch (error) {
        console.error('Fetch analytics metrics API error:', error);
        return res.status(500).json({ success: false, error: 'Failed to fetch analytics metrics.' });
    }
});

module.exports = router;
