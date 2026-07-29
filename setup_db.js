require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function setupDatabase() {
    try {
        console.log('Connecting to MySQL server...');
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            multipleStatements: true
        });

        console.log('Connected to MySQL. Executing schema.sql...');
        const schemaPath = path.join(__dirname, 'schema.sql');
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');
        
        await connection.query(schemaSql);
        console.log('Schema executed successfully.');

        console.log('Executing seed.sql...');
        const seedPath = path.join(__dirname, 'seed.sql');
        const seedSql = fs.readFileSync(seedPath, 'utf8');

        await connection.query(seedSql);
        console.log('Seed data inserted successfully.');

        await connection.end();
        console.log('Database setup complete.');
        process.exit(0);
    } catch (err) {
        console.error('Error during database setup:', err);
        process.exit(1);
    }
}

setupDatabase();
