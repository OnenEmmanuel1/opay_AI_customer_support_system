-- OpaySupportAI Database Schema

DROP DATABASE IF EXISTS ai_banking_support_v2;
CREATE DATABASE ai_banking_support_v2;
USE ai_banking_support_v2;

-- Disable foreign key checks to prevent drop table errors
SET FOREIGN_KEY_CHECKS = 0;

-- Drop all tables (both new and legacy) to ensure a clean slate
DROP TABLE IF EXISTS tickets;
DROP TABLE IF EXISTS chat_logs;
DROP TABLE IF EXISTS transactions;
DROP TABLE IF EXISTS wallets;
DROP TABLE IF EXISTS intents;
DROP TABLE IF EXISTS bills;

DROP TABLE IF EXISTS nlp_responses;
DROP TABLE IF EXISTS nlp_utterances;
DROP TABLE IF EXISTS nlp_intents;
DROP TABLE IF EXISTS simulated_transactions;
DROP TABLE IF EXISTS simulated_accounts;
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS conversations;
DROP TABLE IF EXISTS users;

-- Re-enable foreign key checks for table creation
SET FOREIGN_KEY_CHECKS = 1;

-- 1. Users Table
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) DEFAULT NULL,
    google_id VARCHAR(255) UNIQUE DEFAULT NULL,
    facebook_id VARCHAR(255) UNIQUE DEFAULT NULL,
    role ENUM('customer', 'agent', 'admin') NOT NULL DEFAULT 'customer',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Conversations Table
CREATE TABLE conversations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP NULL DEFAULT NULL,
    FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 3. Messages Table
CREATE TABLE messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    conversation_id INT NOT NULL,
    sender ENUM('user', 'bot', 'agent') NOT NULL,
    content TEXT NOT NULL,
    detected_intent VARCHAR(100) DEFAULT NULL,
    confidence_score DECIMAL(5, 4) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

-- 4. Simulated Transactions Table
CREATE TABLE simulated_transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    reference_number VARCHAR(100) NOT NULL UNIQUE,
    customer_id INT NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    status ENUM('pending', 'completed', 'failed') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 5. Simulated Accounts Table
CREATE TABLE simulated_accounts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL UNIQUE,
    kyc_status VARCHAR(50) NOT NULL DEFAULT 'Tier 1',
    restriction_status VARCHAR(50) NOT NULL DEFAULT 'Active',
    balance DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 6. Tickets Table
CREATE TABLE tickets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    conversation_id INT NOT NULL,
    category VARCHAR(100) NOT NULL,
    priority ENUM('low', 'medium', 'high', 'urgent') NOT NULL DEFAULT 'medium',
    status ENUM('open', 'in_progress', 'resolved', 'closed') NOT NULL DEFAULT 'open',
    assigned_agent_id INT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP NULL DEFAULT NULL,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_agent_id) REFERENCES users(id) ON DELETE SET NULL
);

-- NLP Intents Registry
CREATE TABLE nlp_intents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tag VARCHAR(100) NOT NULL UNIQUE,
    description VARCHAR(255) DEFAULT NULL
);

-- NLP Utterances (Training Set)
CREATE TABLE nlp_utterances (
    id INT AUTO_INCREMENT PRIMARY KEY,
    intent_id INT NOT NULL,
    utterance TEXT NOT NULL,
    FOREIGN KEY (intent_id) REFERENCES nlp_intents(id) ON DELETE CASCADE
);

-- NLP Response Templates
CREATE TABLE nlp_responses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    intent_id INT NOT NULL UNIQUE,
    response_template TEXT NOT NULL,
    FOREIGN KEY (intent_id) REFERENCES nlp_intents(id) ON DELETE CASCADE
);
