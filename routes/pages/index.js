const express = require('express');
const router = express.Router();

// Landing page
router.get('/', (req, res) => {
    res.render('index', { title: 'Home' });
});

// About page
router.get('/about', (req, res) => {
    res.render('about', { title: 'About Us' });
});

// Services page
router.get('/services', (req, res) => {
    res.render('services', { title: 'Our Services' });
});

// Contact page
router.get('/contact', (req, res) => {
    res.render('contact', { title: 'Contact Support' });
});

// FAQ page
router.get('/faq', (req, res) => {
    res.render('faq', { title: 'FAQs' });
});

// Help Center
router.get('/help', (req, res) => {
    res.render('help', { title: 'Help Center' });
});

module.exports = router;
