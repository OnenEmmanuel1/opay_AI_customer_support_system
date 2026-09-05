const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const db = require('./db');

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID || 'placeholder',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'placeholder',
    callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/auth/google/callback'
  },
  async function(accessToken, refreshToken, profile, cb) {
    try {
        const email = profile.emails && profile.emails.length > 0 ? profile.emails[0].value : null;
        if (!email) {
            return cb(new Error("No email found from Google profile"));
        }

        // Check if user already exists by google_id
        const [rows] = await db.query('SELECT * FROM users WHERE google_id = ?', [profile.id]);
        if (rows.length > 0) {
            return cb(null, rows[0]);
        }

        // If not found by google_id, check if a user with the same email exists
        const [emailRows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        if (emailRows.length > 0) {
            // User exists, link the google_id to the existing user
            const user = emailRows[0];
            await db.query('UPDATE users SET google_id = ? WHERE id = ?', [profile.id, user.id]);
            user.google_id = profile.id;
            return cb(null, user);
        }

        // New user! Insert them into the DB without a password (since they use Google)
        const name = profile.displayName || 'Google User';
        
        const connection = await db.getConnection();
        let customerId;
        let newUser;
        try {
            await connection.beginTransaction();

            const [result] = await connection.query(
                'INSERT INTO users (name, email, google_id, role) VALUES (?, ?, ?, "customer")',
                [name, email, profile.id]
            );

            customerId = result.insertId;

            // Create simulated account for the new user
            const initialBalance = 1000.00;
            await connection.query(
                'INSERT INTO simulated_accounts (customer_id, kyc_status, restriction_status, balance) VALUES (?, "Tier 1", "Active", ?)',
                [customerId, initialBalance]
            );

            await connection.commit();

            // Fetch the newly created user
            const [newUsers] = await db.query('SELECT * FROM users WHERE id = ?', [customerId]);
            newUser = newUsers[0];

        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }

        return cb(null, newUser);

    } catch (error) {
        return cb(error, null);
    }
  }
));

passport.use(new FacebookStrategy({
    clientID: process.env.FACEBOOK_APP_ID || 'placeholder',
    clientSecret: process.env.FACEBOOK_APP_SECRET || 'placeholder',
    callbackURL: process.env.FACEBOOK_CALLBACK_URL || 'http://localhost:3000/auth/facebook/callback',
    profileFields: ['id', 'displayName', 'emails']
  },
  async function(accessToken, refreshToken, profile, cb) {
    try {
        const email = profile.emails && profile.emails.length > 0 ? profile.emails[0].value : null;
        if (!email) {
            return cb(new Error("No email found from Facebook profile"));
        }

        // Check if user already exists by facebook_id
        const [rows] = await db.query('SELECT * FROM users WHERE facebook_id = ?', [profile.id]);
        if (rows.length > 0) {
            return cb(null, rows[0]);
        }

        // If not found by facebook_id, check if a user with the same email exists
        const [emailRows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        if (emailRows.length > 0) {
            // User exists, link the facebook_id to the existing user
            const user = emailRows[0];
            await db.query('UPDATE users SET facebook_id = ? WHERE id = ?', [profile.id, user.id]);
            user.facebook_id = profile.id;
            return cb(null, user);
        }

        // New user! Insert them into the DB without a password
        const name = profile.displayName || 'Facebook User';
        
        const connection = await db.getConnection();
        let customerId;
        let newUser;
        try {
            await connection.beginTransaction();

            const [result] = await connection.query(
                'INSERT INTO users (name, email, facebook_id, role) VALUES (?, ?, ?, "customer")',
                [name, email, profile.id]
            );

            customerId = result.insertId;

            // Create simulated account for the new user
            const initialBalance = 1000.00;
            await connection.query(
                'INSERT INTO simulated_accounts (customer_id, kyc_status, restriction_status, balance) VALUES (?, "Tier 1", "Active", ?)',
                [customerId, initialBalance]
            );

            await connection.commit();

            // Fetch the newly created user
            const [newUsers] = await db.query('SELECT * FROM users WHERE id = ?', [customerId]);
            newUser = newUsers[0];

        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }

        return cb(null, newUser);

    } catch (error) {
        return cb(error, null);
    }
  }
));

// We don't necessarily need serialization logic if we're just extracting info to dump into express-session manually,
// but let's provide it in case passport.session() relies on it.
passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [id]);
        if (rows.length > 0) {
            done(null, rows[0]);
        } else {
            done(null, false);
        }
    } catch (err) {
        done(err, null);
    }
});

module.exports = passport;
