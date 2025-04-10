// middleware/isAdmin.js
module.exports = function (req, res, next) {
    if (!req.isAuthenticated()) {
        req.flash('error', 'You must be logged in to access this page');
        return res.redirect('/login');
    }
    
    if (!req.user || req.user.role !== 'admin') {
        req.flash('error', 'Access denied. Admin privileges required.');
        return res.redirect('/listings');
    }
    
    next();
}; 