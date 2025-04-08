// middleware/isManager.js
module.exports = function (req, res, next) {
    if (!req.isAuthenticated()) {
        req.flash('error', 'You must be logged in to access this page');
        return res.redirect('/login');
    }
    
    if (!req.user || req.user.role !== 'manager') {
        req.flash('error', 'Access denied. Manager privileges required.');
        return res.redirect('/listings');
    }
    
    next();
};
