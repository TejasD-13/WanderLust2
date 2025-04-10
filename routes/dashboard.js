const express = require('express');
const router = express.Router();
const Listing = require('../models/Listing');
const Booking = require('../models/Booking');
const isLoggedIn = require('../middleware/isLoggedIn');
const isManager = require('../middleware/isManager');

// User Dashboard
router.get("/user", isLoggedIn, async (req, res) => {
    try {
        // Get all bookings for the current user
        const bookings = await Booking.find({ user: req.user._id })
            .populate('listing')
            .sort({ createdAt: -1 }); // Sort by newest first
        
        res.render("dashboard/user", { bookings });
    } catch (err) {
        console.error("User Dashboard Error:", err);
        req.flash("error", "Failed to load your bookings");
        res.redirect("/listings");
    }
});

// Print Receipt Route
router.get("/receipt/:bookingId", isLoggedIn, async (req, res) => {
    try {
        const { bookingId } = req.params;
        
        // Find the booking and ensure it belongs to the current user
        const booking = await Booking.findById(bookingId)
            .populate('listing')
            .populate('user');
            
        if (!booking) {
            req.flash("error", "Booking not found");
            return res.redirect("/dashboard/user");
        }
        
        // Security check - ensure the booking belongs to the current user
        if (!booking.user._id.equals(req.user._id)) {
            req.flash("error", "You don't have permission to view this receipt");
            return res.redirect("/dashboard/user");
        }
        
        res.render("dashboard/receipt", { booking });
    } catch (err) {
        console.error("Receipt Error:", err);
        req.flash("error", "Failed to generate receipt");
        res.redirect("/dashboard/user");
    }
});

// Manager Dashboard
router.get("/manager", isLoggedIn, isManager, async (req, res) => {
    try {
        // Get date range from query parameters or use default (last 30 days)
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);

        if (req.query.startDate && req.query.endDate) {
            startDate.setTime(new Date(req.query.startDate).getTime());
            endDate.setTime(new Date(req.query.endDate).getTime());
        }

        // Get ALL bookings regardless of date range
        const bookings = await Booking.find({})
            .populate('listing')
            .populate('user')
            .sort({ createdAt: -1 }); // Sort by newest first

        // Filter out bookings with invalid references
        const validBookings = bookings.filter(booking => booking.listing && booking.user);

        // If there are any invalid bookings, log them and remove them
        if (validBookings.length < bookings.length) {
            console.warn(`Found ${bookings.length - validBookings.length} bookings with invalid references`);
            const invalidBookings = bookings.filter(booking => !booking.listing || !booking.user);
            for (const booking of invalidBookings) {
                console.warn(`Removing invalid booking: ${booking._id}`);
                await Booking.findByIdAndDelete(booking._id);
            }
        }

        // Get all listings
        const listings = await Listing.find();

        // Calculate analytics data using only valid bookings
        const analytics = {
            totalBookings: validBookings.length,
            totalRevenue: validBookings.reduce((sum, booking) => sum + booking.totalPrice, 0),
            averageRating: listings.reduce((sum, listing) => sum + (listing.reviews?.length || 0), 0) / (listings.length || 1),
            occupancyRate: (validBookings.length / (listings.length * 30)) * 100 // Assuming 30 days period
        };

        // Generate daily data for charts using only valid bookings
        const dailyData = {};
        const currentDate = new Date(startDate);
        
        while (currentDate <= endDate) {
            const dateStr = currentDate.toISOString().split('T')[0];
            dailyData[dateStr] = {
                bookings: 0,
                revenue: 0
            };
            currentDate.setDate(currentDate.getDate() + 1);
        }

        // Fill in actual booking data using only valid bookings
        validBookings.forEach(booking => {
            const days = Math.ceil((booking.checkOut - booking.checkIn) / (1000 * 60 * 60 * 24));
            const dailyRevenue = booking.totalPrice / days;
            
            const bookingStart = new Date(Math.max(booking.checkIn.getTime(), startDate.getTime()));
            const bookingEnd = new Date(Math.min(booking.checkOut.getTime(), endDate.getTime()));
            
            let currentDay = new Date(bookingStart);
            while (currentDay <= bookingEnd) {
                const dateStr = currentDay.toISOString().split('T')[0];
                if (dailyData[dateStr]) {
                    dailyData[dateStr].bookings++;
                    dailyData[dateStr].revenue += dailyRevenue;
                }
                currentDay.setDate(currentDay.getDate() + 1);
            }
        });

        // Prepare chart data
        const chartData = {
            dates: Object.keys(dailyData),
            bookings: Object.values(dailyData).map(d => d.bookings),
            revenue: Object.values(dailyData).map(d => d.revenue)
        };

        console.log('Chart data prepared:', {
            dateRange: `${startDate.toISOString()} to ${endDate.toISOString()}`,
            totalBookings: validBookings.length,
            totalRevenue: analytics.totalRevenue,
            dailyDataPoints: Object.keys(dailyData).length
        });

        res.render("dashboard/manager", {
            analytics,
            chartData: JSON.stringify(chartData),
            startDate: startDate.toISOString().split('T')[0],
            endDate: endDate.toISOString().split('T')[0],
            bookings: validBookings
        });
    } catch (err) {
        console.error("Dashboard Error:", err);
        req.flash("error", "Failed to load dashboard data");
        res.redirect("/listings");
    }
});

module.exports = router;