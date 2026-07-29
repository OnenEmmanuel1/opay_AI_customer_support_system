const express = require('express');
const router = express.Router();
const db = require('../../config/db');
const aiopEngine = require('../../engine/aiopEngine');
const { isCustomer, isAgentOrAdmin } = require('../../middlewares/auth');

// Get active conversation history for the logged-in customer
router.get('/history', isCustomer, async (req, res) => {
    const customerId = req.session.user.id;

    try {
        // Find or create active conversation
        let conversationId = null;
        const [conversations] = await db.query(
            'SELECT id FROM conversations WHERE customer_id = ? AND ended_at IS NULL ORDER BY started_at DESC LIMIT 1',
            [customerId]
        );

        if (conversations.length > 0) {
            conversationId = conversations[0].id;
        } else {
            const [result] = await db.query(
                'INSERT INTO conversations (customer_id) VALUES (?)',
                [customerId]
            );
            conversationId = result.insertId;
        }

        // Fetch messages for this conversation
        const [messages] = await db.query(
            'SELECT sender, content, detected_intent, confidence_score, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at ASC',
            [conversationId]
        );

        return res.status(200).json({ success: true, conversationId, messages });
    } catch (error) {
        console.error('Fetch chat history API error:', error);
        return res.status(500).json({ success: false, error: 'Failed to retrieve chat history.' });
    }
});

// Send message to AI chatbot
router.post('/send', isCustomer, async (req, res) => {
    const customerId = req.session.user.id;
    const { message } = req.body;

    if (!message || message.trim() === '') {
        return res.status(400).json({ success: false, error: 'Message content is required.' });
    }

    try {
        // 1. Find or create active conversation
        let conversationId = null;
        const [conversations] = await db.query(
            'SELECT id FROM conversations WHERE customer_id = ? AND ended_at IS NULL ORDER BY started_at DESC LIMIT 1',
            [customerId]
        );

        if (conversations.length > 0) {
            conversationId = conversations[0].id;
        } else {
            const [result] = await db.query(
                'INSERT INTO conversations (customer_id) VALUES (?)',
                [customerId]
            );
            conversationId = result.insertId;
        }

        // 2. Save user message
        const [userMsgResult] = await db.query(
            'INSERT INTO messages (conversation_id, sender, content) VALUES (?, "user", ?)',
            [conversationId, message]
        );

        // 3. Process with AI Engine
        const classification = aiopEngine.classifyIntent(message);
        const tone = aiopEngine.analyzeTone(message);
        
        const confidenceThreshold = parseFloat(process.env.CONFIDENCE_THRESHOLD) || 0.40;
        let responseText = '';
        let shouldEscalate = false;
        let category = 'other';
        let priority = 'medium';

        // Intent categorisation mappings for tickets
        const categoryMap = {
            failed_transfer: 'failed_transaction',
            pending_transfer: 'failed_transaction',
            account_blocked: 'account_restriction',
            kyc_issue: 'kyc_issue',
            card_issues: 'card_issue'
        };

        if (classification.confidence < confidenceThreshold) {
            shouldEscalate = true;
            responseText = "I'm having trouble resolving that. I've automatically created a support ticket and assigned it to a human agent to review.";
        } else {
            responseText = await aiopEngine.generateResponse(classification.intent, customerId, message);
            
            if (classification.intent === 'create_ticket') {
                shouldEscalate = true;
            } else if (categoryMap[classification.intent]) {
                category = categoryMap[classification.intent];
                if (classification.intent === 'account_blocked') priority = 'high';
            }
        }

        let ticketDetails = null;

        // 4. Ticket escalation logic
        if (shouldEscalate) {
            const ticket = await aiopEngine.escalateToTicket(conversationId, category, priority);
            if (ticket) {
                ticketDetails = ticket;
                responseText += ` [Support Ticket #${ticket.ticketId} created and assigned.]`;
            }
        }

        // 5. Save bot message
        const [botMsgResult] = await db.query(
            'INSERT INTO messages (conversation_id, sender, content, detected_intent, confidence_score) VALUES (?, "bot", ?, ?, ?)',
            [conversationId, responseText, classification.intent, classification.confidence]
        );

        // 6. Return response
        return res.status(200).json({
            success: true,
            userMessage: {
                id: userMsgResult.insertId,
                sender: 'user',
                content: message,
                created_at: new Date()
            },
            botMessage: {
                id: botMsgResult.insertId,
                sender: 'bot',
                content: responseText,
                detected_intent: classification.intent,
                confidence_score: classification.confidence,
                created_at: new Date()
            },
            ticketDetails
        });

    } catch (error) {
        console.error('Chat send message API error:', error);
        return res.status(500).json({ success: false, error: 'Internal chat processor error.' });
    }
});

// Clear active conversation (marks ended_at)
router.post('/clear', isCustomer, async (req, res) => {
    const customerId = req.session.user.id;

    try {
        await db.query(
            'UPDATE conversations SET ended_at = CURRENT_TIMESTAMP WHERE customer_id = ? AND ended_at IS NULL',
            [customerId]
        );
        return res.status(200).json({ success: true, message: 'Chat session cleared. A new session will begin.' });
    } catch (error) {
        console.error('Clear chat API error:', error);
        return res.status(500).json({ success: false, error: 'Failed to clear chat session.' });
    }
});

// Admin/Agent fetch full conversation log for monitoring
router.get('/log/:conversationId', isAgentOrAdmin, async (req, res) => {
    try {
        const [messages] = await db.query(
            `SELECT m.*, u.name as customer_name 
             FROM messages m
             JOIN conversations c ON m.conversation_id = c.id
             JOIN users u ON c.customer_id = u.id
             WHERE m.conversation_id = ? 
             ORDER BY m.created_at ASC`,
            [req.params.conversationId]
        );

        return res.status(200).json({ success: true, messages });
    } catch (error) {
        console.error('Fetch conversation log API error:', error);
        return res.status(500).json({ success: false, error: 'Failed to retrieve conversation logs.' });
    }
});

module.exports = router;
