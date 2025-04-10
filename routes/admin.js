const express = require('express');
const router = express.Router();
const Listing = require('../models/Listing');
const isLoggedIn = require('../middleware/isLoggedIn');
const isAdmin = require('../middleware/isAdmin');

// Admin Dashboard
router.get("/dashboard", isLoggedIn, isAdmin, async (req, res) => {
    try {
        // Get all listings (both approved and pending)
        const allListings = await Listing.find({}).populate('owner');
        
        // Separate approved and pending listings
        const approvedListings = allListings.filter(listing => listing.isApproved);
        const pendingListings = allListings.filter(listing => !listing.isApproved);
        
        res.render("admin/dashboard", { 
            approvedListings, 
            pendingListings 
        });
    } catch (err) {
        console.error("Admin Dashboard Error:", err);
        req.flash("error", "Failed to load admin dashboard");
        res.redirect("/listings");
    }
});

// Approve a listing
router.post("/listings/:id/approve", isLoggedIn, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        await Listing.findByIdAndUpdate(id, { isApproved: true });
        req.flash("success", "Listing approved successfully!");
        res.redirect("/admin/dashboard");
    } catch (err) {
        console.error("Listing Approval Error:", err);
        req.flash("error", "Failed to approve listing");
        res.redirect("/admin/dashboard");
    }
});

// Reject a listing
router.post("/listings/:id/reject", isLoggedIn, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        await Listing.findByIdAndDelete(id);
        req.flash("success", "Listing rejected and deleted successfully!");
        res.redirect("/admin/dashboard");
    } catch (err) {
        console.error("Listing Rejection Error:", err);
        req.flash("error", "Failed to reject listing");
        res.redirect("/admin/dashboard");
    }
});

// Delete a listing
router.delete("/listings/:id", isLoggedIn, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        await Listing.findByIdAndDelete(id);
        req.flash("success", "Listing deleted successfully!");
        res.redirect("/admin/dashboard");
    } catch (err) {
        console.error("Listing Deletion Error:", err);
        req.flash("error", "Failed to delete listing");
        res.redirect("/admin/dashboard");
    }
});

module.exports = router; 