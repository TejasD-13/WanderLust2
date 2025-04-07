const express = require('express');
const router = express.Router();
const Listing = require('../models/listing');
const Booking = require('../models/booking');
const { isLoggedIn, isManager } = require('../utils/roleMiddleware');

// User Dashboard
router.get('/user', isLoggedIn, async (req, res) => {
    try {
        const bookings = await Booking.find({ user: req.user._id })
            .populate({
                path: 'listing',
                populate: { path: 'owner' }
            })
            .populate('user')
            .sort({ checkIn: -1 })
            .exec();
            
        res.render('dashboard/user', { 
            bookings,
            user: req.user
        });
    } catch (err) {
        req.flash('error', 'Failed to load user dashboard');
        res.redirect('/listings');
    }
});

// Manager Dashboard
router.get('/manager', isLoggedIn, isManager, async (req, res) => {
    try {
        const listings = await Listing.find({ owner: req.user._id });
        const listingIds = listings.map(l => l._id);
        
        const bookings = await Booking.find({ listing: { $in: listingIds } })
            .populate({
                path: 'user',
                options: { retainNullValues: true }
            })
            .populate({
                path: 'listing',
                options: { retainNullValues: true }
            })
            .sort({ checkIn: -1 })
            .limit(10);

        // Calculate stats
        const revenue = bookings.reduce((sum, b) => sum + b.totalPrice, 0);
        const totalBeds = listings.reduce((sum, l) => sum + l.beds, 0);
        const bookedDays = bookings.reduce((sum, b) => {
            const diff = Math.ceil((b.checkOut - b.checkIn) / (1000 * 60 * 60 * 24));
            return sum + diff;
        }, 0);
        const occupancyRate = totalBeds > 0 
            ? ((bookedDays / (totalBeds * 30)) * 100).toFixed(2) // Assuming 30-day month
            : 0;

        res.render('dashboard/manager', {
            user: req.user,
            listings,
            bookings,
            revenue,
            occupancy: occupancyRate,
            totalListings: listings.length,
            activeBookings: bookings.length
        });
    } catch (err) {
        req.flash('error', 'Failed to load manager dashboard');
        res.redirect('/listings');
    }
});

module.exports = router;
