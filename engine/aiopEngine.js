// OpaySupportAI Central Business Logic Engine
const natural = require('natural');
const db = require('../config/db');

// Tokenizer
const tokenizer = new natural.WordTokenizer();

let classifier = new natural.BayesClassifier();
let isTrained = false;

// 1. Text Preprocessing
function preprocessText(text) {
    if (!text) return '';
    let processed = text.toLowerCase();
    // Keep letters, numbers, naira sign, spaces, and hyphens
    processed = processed.replace(/[^a-z0-9₦\s\-]/g, '');
    return processed;
}

// 2. Training the Classifier
async function trainClassifier() {
    try {
        const [intents] = await db.query('SELECT * FROM nlp_intents');
        if (intents.length === 0) {
            console.log('No intents found in database to train NLP classifier.');
            return false;
        }

        const newClassifier = new natural.BayesClassifier();
        let documentCount = 0;

        for (const intent of intents) {
            const [utterances] = await db.query('SELECT utterance FROM nlp_utterances WHERE intent_id = ?', [intent.id]);
            for (const u of utterances) {
                newClassifier.addDocument(preprocessText(u.utterance), intent.tag);
                documentCount++;
            }
        }

        if (documentCount > 0) {
            newClassifier.train();
            classifier = newClassifier;
            isTrained = true;
            console.log(`NLP classifier trained successfully with ${documentCount} utterances.`);
            return true;
        } else {
            console.log('No utterances found to train NLP classifier.');
            return false;
        }
    } catch (error) {
        console.error('Error training NLP classifier:', error);
        return false;
    }
}

// 3. Entity Extraction
function extractEntities(text) {
    const entities = {
        reference: null,
        amount: null,
        date: null
    };

    if (!text) return entities;

    let cleanText = text;

    // Matches references like TXN1000000001
    const refMatch = text.match(/TXN\d+/i);
    if (refMatch) {
        entities.reference = refMatch[0].toUpperCase();
        cleanText = cleanText.replace(refMatch[0], ''); // Remove reference number to avoid amount collision
    }

    // Matches amount in naira (e.g. ₦5000, 5000 naira, 2500.00)
    const amountMatch = cleanText.match(/(?:₦\s?)?(\d+(?:\.\d{2})?)\b/);
    if (amountMatch) {
        entities.amount = parseFloat(amountMatch[1]);
    }

    // Simple date match
    const dateMatch = cleanText.match(/\b\d{4}-\d{2}-\d{2}\b/);
    if (dateMatch) {
        entities.date = dateMatch[0];
    }

    return entities;
}

// 4. Tone Analysis (Lexicon word matching)
function analyzeTone(text) {
    if (!text) return 'neutral';
    const processed = text.toLowerCase();
    
    const positiveWords = ['happy', 'great', 'thanks', 'thank', 'awesome', 'good', 'excellent', 'solved', 'helpful', 'perfect'];
    const negativeWords = ['failed', 'blocked', 'worst', 'bad', 'angry', 'error', 'fraud', 'steal', 'terrible', 'useless', 'restrict', 'stuck', 'annoyed'];
    
    let score = 0;
    positiveWords.forEach(w => { if (processed.includes(w)) score++; });
    negativeWords.forEach(w => { if (processed.includes(w)) score--; });
    
    if (score > 0) return 'positive';
    if (score < 0) return 'negative';
    return 'neutral';
}

// 5. Intent Classification with Softmax confidence
function classifyIntent(text) {
    if (!isTrained) {
        return { intent: 'greeting', confidence: 1.0, classifications: [] };
    }
    const processed = preprocessText(text);
    const rawClassifications = classifier.getClassifications(processed);
    
    if (!rawClassifications || rawClassifications.length === 0) {
        return { intent: 'greeting', confidence: 0.0, classifications: [] };
    }

    // Sort descending by score
    rawClassifications.sort((a, b) => b.value - a.value);

    // Apply Softmax over the raw values (since they are in log-probability space)
    const maxVal = rawClassifications[0].value;
    let sumExp = 0;
    
    const scores = rawClassifications.map(c => {
        const expVal = Math.exp(c.value - maxVal);
        sumExp += expVal;
        return { label: c.label, expVal };
    });

    const normalizedClassifications = scores.map(s => {
        return {
            label: s.label,
            confidence: s.expVal / sumExp
        };
    });

    const topResult = normalizedClassifications[0];
    return {
        intent: topResult.label,
        confidence: parseFloat(topResult.confidence.toFixed(4)),
        classifications: normalizedClassifications
    };
}

// 6. Response Generation Module & Simulated Banking Service
async function generateResponse(intent, customerId, text = '') {
    const entities = extractEntities(text);

    // Contextual actions if reference is provided
    if (entities.reference) {
        const [transactions] = await db.query(
            'SELECT * FROM simulated_transactions WHERE reference_number = ?',
            [entities.reference]
        );

        if (transactions.length > 0) {
            const tx = transactions[0];
            const amountFormatted = parseFloat(tx.amount).toLocaleString('en-NG', { minimumFractionDigits: 2 });
            if (tx.status === 'completed') {
                return `[Simulated Check] I found transaction ${tx.reference_number}. It was a payment of ₦${amountFormatted} and the status is COMPLETED.`;
            } else if (tx.status === 'failed') {
                return `[Simulated Check] I found transaction ${tx.reference_number}. It was a payment of ₦${amountFormatted} and the status is FAILED. It has been queued for reversal.`;
            } else {
                return `[Simulated Check] I found transaction ${tx.reference_number}. It is currently PENDING. Most pending transfers settle within 24 hours.`;
            }
        } else {
            return `[Simulated Check] I checked our banking logs but couldn't find any transaction with reference ${entities.reference}. Please double check the ID.`;
        }
    }

    // Fetch the response template from database
    const [rows] = await db.query(
        'SELECT r.response_template FROM nlp_responses r JOIN nlp_intents i ON r.intent_id = i.id WHERE i.tag = ?',
        [intent]
    );

    if (rows.length === 0) {
        return "I'm processing your query. Could you please specify your issue or provide a transaction reference?";
    }

    let response = rows[0].response_template;

    // Resolve template variables using simulated accounts
    if (response.includes('{{balance}}') || response.includes('{{kyc_status}}') || response.includes('{{restriction_status}}')) {
        const [accounts] = await db.query('SELECT * FROM simulated_accounts WHERE customer_id = ?', [customerId]);
        if (accounts.length > 0) {
            const acc = accounts[0];
            response = response.replace('{{balance}}', parseFloat(acc.balance).toLocaleString('en-NG', { minimumFractionDigits: 2 }));
            response = response.replace('{{kyc_status}}', acc.kyc_status);
            response = response.replace('{{restriction_status}}', acc.restriction_status);
        } else {
            response = response.replace('{{balance}}', '0.00');
            response = response.replace('{{kyc_status}}', 'Unverified');
            response = response.replace('{{restriction_status}}', 'Restricted');
        }
    }

    return response;
}

// 7. Ticketing & Escalation Module (Workload balancing assignment)
async function escalateToTicket(conversationId, category, priority = 'medium') {
    try {
        // Find the conversation customer_id
        const [convs] = await db.query('SELECT customer_id FROM conversations WHERE id = ?', [conversationId]);
        if (convs.length === 0) return null;
        
        // Find all support agents and admins
        const [agents] = await db.query('SELECT id FROM users WHERE role IN ("agent", "admin")');
        
        let assignedAgentId = null;
        if (agents.length > 0) {
            // Find agent workload: count active/open tickets assigned to each agent
            const [workload] = await db.query(`
                SELECT assigned_agent_id, COUNT(*) as open_tickets 
                FROM tickets 
                WHERE status IN ("open", "in_progress") AND assigned_agent_id IS NOT NULL 
                GROUP BY assigned_agent_id
            `);
            
            // Create workload map
            const workloadMap = {};
            agents.forEach(a => { workloadMap[a.id] = 0; });
            workload.forEach(w => { workloadMap[w.assigned_agent_id] = w.open_tickets; });
            
            // Find agent with the lowest workload (workload-balanced round-robin)
            let minWorkload = Infinity;
            agents.forEach(a => {
                if (workloadMap[a.id] < minWorkload) {
                    minWorkload = workloadMap[a.id];
                    assignedAgentId = a.id;
                }
            });
        }

        // Insert new ticket
        const [result] = await db.query(
            'INSERT INTO tickets (conversation_id, category, priority, status, assigned_agent_id) VALUES (?, ?, ?, ?, ?)',
            [conversationId, category, priority, 'open', assignedAgentId]
        );

        return {
            ticketId: result.insertId,
            assignedAgentId
        };
    } catch (error) {
        console.error('Error creating support ticket during escalation:', error);
        return null;
    }
}

module.exports = {
    preprocessText,
    trainClassifier,
    extractEntities,
    analyzeTone,
    classifyIntent,
    generateResponse,
    escalateToTicket,
    getIsTrained: () => isTrained
};
