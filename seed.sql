-- OpaySupportAI Database Seed File
USE ai_banking_support;

-- 1. Seed Users (Password: password123)
-- Hash: $2b$10$X1j8Vb.xV2O5p6v6PZpT0.627r04q/jT3H/m5Yx58J7L6G36/6f6u
INSERT INTO users (id, name, email, password_hash, role) VALUES
(1, 'Super Admin', 'admin@opay.com', '$2b$10$X1j8Vb.xV2O5p6v6PZpT0.627r04q/jT3H/m5Yx58J7L6G36/6f6u', 'admin'),
(2, 'Agent Kelechi', 'agent1@opay.com', '$2b$10$X1j8Vb.xV2O5p6v6PZpT0.627r04q/jT3H/m5Yx58J7L6G36/6f6u', 'agent'),
(3, 'Agent Funmi', 'agent2@opay.com', '$2b$10$X1j8Vb.xV2O5p6v6PZpT0.627r04q/jT3H/m5Yx58J7L6G36/6f6u', 'agent'),
(4, 'Tunde Bakare', 'customer1@opay.com', '$2b$10$X1j8Vb.xV2O5p6v6PZpT0.627r04q/jT3H/m5Yx58J7L6G36/6f6u', 'customer'),
(5, 'Chidi Egwu', 'customer2@opay.com', '$2b$10$X1j8Vb.xV2O5p6v6PZpT0.627r04q/jT3H/m5Yx58J7L6G36/6f6u', 'customer'),
(6, 'Fatima Bello', 'customer3@opay.com', '$2b$10$X1j8Vb.xV2O5p6v6PZpT0.627r04q/jT3H/m5Yx58J7L6G36/6f6u', 'customer');

-- 2. Seed Simulated Accounts
INSERT INTO simulated_accounts (customer_id, kyc_status, restriction_status, balance) VALUES
(4, 'Tier 3', 'Active', 250500.00),
(5, 'Tier 2', 'Restricted', 12000.50),
(6, 'Tier 1', 'Active', 500.00);

-- 3. Seed Simulated Transactions
INSERT INTO simulated_transactions (reference_number, customer_id, amount, status) VALUES
('TXN1000000001', 4, 5000.00, 'completed'),
('TXN1000000002', 4, 20000.00, 'failed'),
('TXN2000000001', 5, 15000.00, 'pending'),
('TXN3000000001', 6, 1500.00, 'completed');

-- 4. Seed NLP Intents
INSERT INTO nlp_intents (id, tag, description) VALUES
(1, 'greeting', 'Standard greetings'),
(2, 'goodbye', 'Customer leaving'),
(3, 'check_balance', 'Account balance inquiry'),
(4, 'failed_transfer', 'Failed transaction investigation'),
(5, 'pending_transfer', 'Stuck or processing transaction inquiry'),
(6, 'account_blocked', 'Account freeze or restriction inquiry'),
(7, 'kyc_issue', 'Identity verification issues'),
(8, 'card_issues', 'ATM/Virtual card queries'),
(9, 'create_ticket', 'Explicit customer request to speak to human agent');

-- 5. Seed NLP Utterances (Training Dataset)
INSERT INTO nlp_utterances (intent_id, utterance) VALUES
-- Greetings
(1, 'hello'), (1, 'hi'), (1, 'hey'), (1, 'good morning'), (1, 'good afternoon'), (1, 'good evening'), (1, 'anybody there'), (1, 'howdy'), (1, 'yo'),
-- Goodbye
(2, 'bye'), (2, 'goodbye'), (2, 'see you later'), (2, 'thanks bye'), (2, 'exit'), (2, 'quit'),
-- Balance Check
(3, 'what is my balance'), (3, 'how much do i have'), (3, 'check balance'), (3, 'wallet balance'), (3, 'account balance'), (3, 'show my balance'), (3, 'my balance'), (3, 'view balance'), (3, 'check wallet money'),
-- Failed Transfer
(4, 'my transfer failed'), (4, 'failed transfer'), (4, 'money not delivered'), (4, 'debited but not received'), (4, 'stuck transaction'), (4, 'transfer declined'), (4, 'zenith bank transfer failed'), (4, 'gtbank transfer failed'), (4, 'failed payment'), (4, 'transaction failed'),
-- Pending Transfer
(5, 'transfer is pending'), (5, 'pending transaction'), (5, 'why is my payment pending'), (5, 'processing transfer'), (5, 'still processing'), (5, 'transaction pending'), (5, 'pending transfer'), (5, 'my payment is stuck'),
-- Account Blocked
(6, 'my account is blocked'), (6, 'cannot log in'), (6, 'account restricted'), (6, 'unblock my account'), (6, 'access denied'), (6, 'frozen wallet'), (6, 'why is my account frozen'), (6, 'unfreeze account'), (6, 'restrict my account'),
-- KYC Issue
(7, 'verify my account'), (7, 'kyc verification'), (7, 'bvn check'), (7, 'upgrade my tier'), (7, 'tier 2 upgrade'), (7, 'verification failed'), (7, 'bvn upload'), (7, 'how to verify kyc'), (7, 'kyc documents'),
-- Card Issues
(8, 'card not working'), (8, 'lost card'), (8, 'atm card declined'), (8, 'block card'), (8, 'my virtual card'), (8, 'request new card'), (8, 'activate virtual card'), (8, 'atm card issues'),
-- Create Ticket
(9, 'open a ticket'), (9, 'talk to agent'), (9, 'speak with human'), (9, 'escalate'), (9, 'complain to support'), (9, 'connect me to an agent'), (9, 'human help');

-- 6. Seed NLP Responses
INSERT INTO nlp_responses (intent_id, response_template) VALUES
(1, 'Hello! Welcome to OPay Support. How can I help you today? You can ask about transfer status, account blocks, or KYC verification.'),
(2, 'Thank you for using OPay Support. Have a wonderful day!'),
(3, 'Your current account balance is ₦{{balance}}.'),
(4, 'I see you have a transfer issue. Please check the transaction status by providing the reference number (e.g. TXN1000000002).'),
(5, 'For pending transactions, they usually settle within 24 hours. Please check the status by providing your reference number.'),
(6, 'Your simulated account status is currently: {{restriction_status}}. If it is restricted or frozen, please submit a ticket for manual verification.'),
(7, 'Your current KYC verification tier is: {{kyc_status}}. If you need to upgrade, please open a support ticket.'),
(8, 'For card-related issues, please specify if you want to block or replace your card, or open a ticket.'),
(9, 'I will escalate this request. An agent will contact you shortly.');
