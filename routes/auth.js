const express = require('express');
const passport = require('passport');
const User = require('../models/user');

const router = express.Router();

// Show login form
router.get('/login', (req, res) => {
    res.render('auth/login');
});

// Handle login logic
router.post('/login', passport.authenticate('local', {
    failureRedirect: '/login',
    failureFlash: true
}), (req, res) => {
    if (req.user.role === 'admin') {
        res.redirect('/admin/dashboard');
    } else if (req.user.role === 'manager') {
        res.redirect('/dashboard/manager');
    } else {
        res.redirect('/listings');
    }
});

// Show register form
router.get('/register', (req, res) => {
    res.render('auth/register');
});

// Handle register logic
router.post('/register', async (req, res, next) => {
    try {
        const { username, email, password, role } = req.body;
        console.log('Registration data:', { username, email, role });
        const newUser = new User({ username, email, password, role });
        try {
            await newUser.save();
            req.login(newUser, err => {
                if (err) {
                    req.flash('error', 'Auto-login failed. Please login manually');
                    return res.redirect('/login');
                }
                if (newUser.role === 'admin') {
                    res.redirect('/admin/dashboard');
                } else if (newUser.role === 'manager') {
                    res.redirect('/dashboard/manager');
                } else {
                    res.redirect('/listings');
                }
            });
        } catch (err) {
            req.flash('error', 'Registration failed: ' + err.message);
            res.redirect('/register');
        }
    } catch (err) {
        next(err);
    }
});

// Logout
router.get('/logout', (req, res, next) => {
    req.logout(err => {
        if (err) return next(err);
        res.redirect('/login');
    });
});

module.exports = router;
