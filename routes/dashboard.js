const express = require('express');
const router = express.Router();
const Listing = require('../models/Listing');
const Booking = require('../models/Booking');
const isLoggedIn = require('../middleware/isLoggedIn');
const isManager = require('../middleware/isManager');

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

        // Get all bookings that overlap with the date range
        const bookings = await Booking.find({
            $or: [
                // Bookings that start within the date range
                { checkIn: { $gte: startDate, $lte: endDate } },
                // Bookings that end within the date range
                { checkOut: { $gte: startDate, $lte: endDate } },
                // Bookings that span the entire date range
                { 
                    checkIn: { $lte: startDate },
                    checkOut: { $gte: endDate }
                }
            ]
        }).populate('listing');

        // Get all listings
        const listings = await Listing.find();

        // Calculate analytics data
        const analytics = {
            totalBookings: bookings.length,
            totalRevenue: bookings.reduce((sum, booking) => sum + booking.totalPrice, 0),
            averageRating: listings.reduce((sum, listing) => sum + (listing.reviews?.length || 0), 0) / (listings.length || 1),
            occupancyRate: (bookings.length / (listings.length * 30)) * 100 // Assuming 30 days period
        };

        // Generate daily data for charts
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

        // Fill in actual booking data
        bookings.forEach(booking => {
            // Calculate the daily revenue (total price divided by number of days)
            const days = Math.ceil((booking.checkOut - booking.checkIn) / (1000 * 60 * 60 * 24));
            const dailyRevenue = booking.totalPrice / days;
            
            // For each day in the booking period
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
            totalBookings: bookings.length,
            totalRevenue: analytics.totalRevenue,
            dailyDataPoints: Object.keys(dailyData).length
        });

        res.render("dashboard/manager", {
            analytics,
            chartData: JSON.stringify(chartData),
            startDate: startDate.toISOString().split('T')[0],
            endDate: endDate.toISOString().split('T')[0]
        });
    } catch (err) {
        console.error("Dashboard Error:", err);
        req.flash("error", "Failed to load dashboard data");
        res.redirect("/listings");
    }
});

module.exports = router;