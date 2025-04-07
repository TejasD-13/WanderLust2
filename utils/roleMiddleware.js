const Listing = require('../models/listing');

const isLoggedIn = (req, res, next) => {
    if (!req.isAuthenticated()) {
        req.flash('error', 'You must be signed in');
        return res.redirect('/login');
    }
    next();
};

const isManager = (req, res, next) => {
    if (req.user.role !== 'manager') {
        req.flash('error', 'Unauthorized access');
        return res.redirect('/listings');
    }
    next();
};

const isOwner = async (req, res, next) => {
    const listing = await Listing.findById(req.params.id);
    if (!listing.owner.equals(req.user._id)) {
        req.flash('error', 'You do not have permission for this action');
        return res.redirect(`/listings/${req.params.id}`);
    }
    next();
};

module.exports = { isLoggedIn, isManager, isOwner };
