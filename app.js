const express = require('express');
const session = require('express-session');
const path = require('path');
require('dotenv').config();

const db = require('./config/db');
const aiopEngine = require('./engine/aiopEngine');

const app = express();

// Body Parser Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static Assets
app.use(express.static(path.join(__dirname, 'public')));

// Express Session Configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'aiop_secret_session_key_2026',
    resave: false,
    saveUninitialized: true,
    cookie: { 
        secure: false, // Set to true if running on HTTPS
        maxAge: 24 * 60 * 60 * 1000 // 24 hours session
    }
}));

// Template Engine Config (EJS)
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Session Injector middleware to make user object globally accessible in EJS views
app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    next();
});

// --- Page-Rendering Routes ---
const pageIndexRoutes = require('./routes/pages/index');
const pageAuthRoutes = require('./routes/pages/auth');
const pageCustomerRoutes = require('./routes/pages/customer');
const pageAdminRoutes = require('./routes/pages/admin');

app.use('/', pageIndexRoutes);
app.use('/auth', pageAuthRoutes);
app.use('/customer', pageCustomerRoutes);
app.use('/admin', pageAdminRoutes);

// --- JSON API Routes ---
const apiAuthRoutes = require('./routes/api/auth');
const apiChatRoutes = require('./routes/api/chat');
const apiTicketRoutes = require('./routes/api/tickets');
const apiAdminRoutes = require('./routes/api/admin');

app.use('/api/auth', apiAuthRoutes);
app.use('/api/chat', apiChatRoutes);
app.use('/api/tickets', apiTicketRoutes);
app.use('/api/admin', apiAdminRoutes);

// Retrain and compile the NLP Model on application startup
async function initializeNLP() {
    console.log('[NLP Init] Initializing NLP Bayesian classifier...');
    const success = await aiopEngine.trainClassifier();
    if (success) {
        console.log('[NLP Init] Classifier compiled and active.');
    } else {
        console.warn('[NLP Warning] Classifier failed to compile on startup. Seeding might be needed.');
    }
}
initializeNLP();

// Global 404 Route
app.use((req, res) => {
    res.status(404).render('index', { title: '404 - Not Found', error: 'Page not found' });
});

// Start listening
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`[Server] OpaySupportAI is running on http://localhost:${PORT}`);
});
