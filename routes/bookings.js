const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');
const isLoggedIn = require('../middleware/isLoggedIn');
const isManager = require('../middleware/isManager');

// View a specific booking
router.get('/:id', isLoggedIn, async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id)
            .populate('listing')
            .populate('user');
        
        if (!booking) {
            req.flash('error', 'Booking not found');
            return res.redirect('/dashboard/manager');
        }
        
        res.render('bookings/show', { booking });
    } catch (err) {
        console.error('Booking View Error:', err);
        req.flash('error', 'Failed to view booking');
        res.redirect('/dashboard/manager');
    }
});

// Confirm a booking
router.post('/:id/confirm', isLoggedIn, isManager, async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id);
        
        if (!booking) {
            req.flash('error', 'Booking not found');
            return res.redirect('/dashboard/manager');
        }
        
        booking.status = 'confirmed';
        await booking.save();
        
        req.flash('success', 'Booking confirmed successfully');
        res.redirect('/dashboard/manager');
    } catch (err) {
        console.error('Booking Confirmation Error:', err);
        req.flash('error', 'Failed to confirm booking');
        res.redirect('/dashboard/manager');
    }
});

// Cancel a booking
router.post('/:id/cancel', isLoggedIn, isManager, async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id);
        
        if (!booking) {
            req.flash('error', 'Booking not found');
            return res.redirect('/dashboard/manager');
        }
        
        booking.status = 'cancelled';
        await booking.save();
        
        req.flash('success', 'Booking cancelled successfully');
        res.redirect('/dashboard/manager');
    } catch (err) {
        console.error('Booking Cancellation Error:', err);
        req.flash('error', 'Failed to cancel booking');
        res.redirect('/dashboard/manager');
    }
});

module.exports = router; 