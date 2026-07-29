# OpaySupportAI ⚡
OPaySupportAI is a production-ready, NLP-powered customer support and banking simulation system built with Node.js, Express, EJS, and MySQL. It features a six-layer architecture, dynamic Bayesian text classification, and a modern, high-contrast flat CSS design system (class prefix `aiop-*`).

---

## Technical Stack & Architecture
- **Web App**: Node.js + Express.js
- **Presentation**: EJS Templating with component partials (Navbar, Footers, Sidebar, Chat Widget).
- **Design System**: Solid flat CSS variables, Inter typography, solid color tokens only (no gradients).
- **Database**: MySQL 8.0, interacting strictly via parameterized queries (using `mysql2` promises).
- **Authentication**: `express-session` cookies + `bcrypt` hashed credentials.
- **NLP Logic Layer**: Dedicated [engine/aiopEngine.js](engine/aiopEngine.js) orchestrating normalization, tokenization (`natural` package), Bayesian classification with Softmax confidence, regex currency/reference extraction, and lexicon-based tone analysis.
- **Routing Separation**: Page-rendering routers (`routes/pages/*.js`) and JSON API endpoints (`routes/api/*.js`) are fully separated.
- **Ticketing Engine**: Auto-escalates chat sessions to tickets on low confidence (score `< 0.40`), assigning them to active agents utilizing workload-balanced round-robin sorting.

---

## Folder Structure
```text
opay/
├── config/
│   └── db.js                 # Database pool connection
├── engine/
│   └── aiopEngine.js         # Core NLP pipeline & banking checkup logic
├── middlewares/
│   └── auth.js               # Customer, Agent, Admin role-based auth guards
├── public/
│   ├── css/
│   │   └── style.css         # Flat CSS design system (aiop-* classes)
│   └── js/
│       └── main.js           # AJAX fetch client-side chat interface
├── routes/
│   ├── api/                  # JSON API controllers
│   │   ├── admin.js          # User status & system analytics metrics
│   │   ├── auth.js           # API signin/signup
│   │   ├── chat.js           # Chat queries & reset endpoints
│   │   └── tickets.js        # Ticket status updates & comments
│   └── pages/                # Page rendering routes
│       ├── admin.js          # Admin dashboard & queue console views
│       ├── auth.js           # Auth views (Login & Register)
│       ├── customer.js       # Customer wallets, transaction logs & tickets
│       └── index.js          # Static public views
├── scratch/
│   └── test-nlp.js           # NLP & simulated banking verification script
├── views/                    # EJS page layouts
│   ├── admin/                # Agent console templates
│   ├── auth/                 # Signin/Signup templates
│   ├── customer/             # Customer dashboard templates
│   └── partials/             # Common partial components
├── Dockerfile                # Express container packaging
├── docker-compose.yml        # Orchestrates Node.js app & MySQL DB containers
├── schema.sql                # MySQL table schemas
├── seed.sql                  # Initial accounts, users, transactions, and NLP data
├── setup_db.js               # CLI DB migration script
└── README.md                 # Project README
```

---

## Database Schema Model
The application utilizes six core tables:
1. `users`: Stores user roles (`customer`, `agent`, `admin`), names, and bcrypt password hashes.
2. `conversations`: Manages support dialogue sessions linked to a customer.
3. `messages`: Stores individual dialogue chat bubbles with `detected_intent` and `confidence_score`.
4. `simulated_transactions`: Simulated banking history containing reference codes (e.g. `TXN1000000001`), amounts, and statuses (`completed`, `failed`, `pending`).
5. `simulated_accounts`: Simulated wallet cards containing `kyc_status`, `restriction_status`, and `balance` decimal values.
6. `tickets`: Support escalations linking conversation contexts to assigned support agents.

---

## Installation & Set Up

### Method 1: Running with Docker Compose (Recommended)
This runs the app and database inside fully isolated containers without needing MySQL installed on your local host:
1. Ensure Docker Desktop is installed and running.
2. Build and launch the containers:
   ```bash
   docker-compose up --build
   ```
3. Once running, the database is automatically created, seeded, and the app serves at `http://localhost:3000`.

### Method 2: Running Locally
1. Ensure a MySQL server is running and configure your connection credentials in a `.env` file based on `.env.example`.
2. Install npm dependencies:
   ```bash
   npm install
   ```
3. Initialize and seed the database:
   ```bash
   node setup_db.js
   ```
4. Run the verification test suite:
   ```bash
   node scratch/test-nlp.js
   ```
5. Start the development server:
   ```bash
   npm run dev
   ```
6. Open your browser and navigate to `http://localhost:3000`.

---

## Test Credentials

All password hashes are seeded with the bcrypt hash of `password123`:

| Role | Username / Email | Password | Description / Simulated Account Data |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@opay.com` | `password123` | Analytics widgets, classifier retraining center, agent registration. |
| **Agent 1** | `agent1@opay.com` | `password123` | Ticket queue filtering, assignment overrides, response inputs. |
| **Agent 2** | `agent2@opay.com` | `password123` | Support console, status log toggles. |
| **Customer 1**| `customer1@opay.com` | `password123`| Balance: ₦250,500.00, KYC Tier 3, Active. Has references `TXN1000000001` (completed) and `TXN1000000002` (failed). |
| **Customer 2**| `customer2@opay.com` | `password123`| Balance: ₦12,000.50, KYC Tier 2, Restricted. Has reference `TXN2000000001` (pending). |
| **Customer 3**| `customer3@opay.com` | `password123`| Balance: ₦500.00, KYC Tier 1, Active. Has reference `TXN3000000001` (completed). |

---

## NLP Training Utterances
The seed script includes training phrases for 7 distinct intent classes:
- `greeting`: Hello / hi queries.
- `goodbye`: Leaving notifications.
- `check_balance`: Wallet balance questions.
- `failed_transfer`: Unsuccessful bank transfer complaints.
- `pending_transfer`: In-process transfer checkups.
- `account_blocked`: restriction/block inquiries.
- `kyc_issue`: Account Tier verification details.
- `card_issues`: Lost card / ATM issues.
- `create_ticket`: Manual requests to escalate to a human agent.
