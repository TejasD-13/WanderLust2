const express = require("express");
const app = express();
const mongoose = require("mongoose");
const path = require("path");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const flash = require("connect-flash");
const User = require("./models/user");
const Listing = require("./models/Listing");
const Review = require("./models/reviews");
const Booking = require("./models/Booking");
const { listingSchema, reviewSchema } = require("./schema.js");
const ExpressError = require("./utils/ExpressError");
const isLoggedIn = require("./middleware/isLoggedIn");
const isManager = require("./middleware/isManager");

// MongoDB connection
mongoose.connect("mongodb://localhost:27017/wanderlust")
    .then(() => console.log("MongoDB Connected Successfully"))
    .catch((err) => console.error("MongoDB Connection Error:", err));

// Session config
const sessionConfig = {
    secret: "thisshouldbeabettersecret!",
    resave: false,
    saveUninitialized: true,
    store: MongoStore.create({
        mongoUrl: "mongodb://localhost:27017/wanderlust",
        touchAfter: 24 * 3600,
    }),
    cookie: {
        httpOnly: true,
        expires: Date.now() + 1000 * 60 * 60 * 24 * 7,
        maxAge: 1000 * 60 * 60 * 24 * 7,
    },
};

// App config
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.engine("ejs", ejsMate);
app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride("_method"));
app.use(session(sessionConfig));
app.use(flash());

// Passport config
app.use(passport.initialize());
app.use(passport.session());

passport.use(new LocalStrategy(async (username, password, done) => {
    try {
        const user = await User.findOne({ username });
        if (!user) {
            console.log('User not found');
            return done(null, false, { message: "Incorrect username." });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            console.log('Password incorrect');
            return done(null, false, { message: "Incorrect password." });
        }

        console.log('Authentication successful');
        return done(null, user);
    } catch (err) {
        console.error('Authentication error:', err);
        return done(err);
    }
}));

passport.serializeUser((user, done) => {
    done(null, user.id);
});
passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (err) {
        done(err);
    }
});

// Middleware
app.use((req, res, next) => {
    res.locals.currentUser = req.user;
    res.locals.success = req.flash('success');
    res.locals.error = req.flash('error');
    res.locals.messages = req.flash();
    next();
});

const validateListing = (req, res, next) => {
    let { error } = listingSchema.validate(req.body);
    if (error) {
        let errMsg = error.details.map((el) => el.message).join(",");
        throw new ExpressError(400, errMsg);
    }
    next();
};

const validateReview = (req, res, next) => {
    let { error } = reviewSchema.validate(req.body);
    if (error) {
        let errMsg = error.details.map((el) => el.message).join(",");
        throw new ExpressError(400, errMsg);
    }
    next();
};

// Middleware to check if user is manager or admin
const isManagerOrAdmin = (req, res, next) => {
    if (req.user.role !== 'manager' && req.user.role !== 'admin') {
        req.flash('error', 'Unauthorized access');
        return res.redirect('/listings');
    }
    next();
};

// Auth Routes
const authRoutes = require("./routes/auth");
const dashboardRoutes = require("./routes/dashboard");
const adminRoutes = require("./routes/admin");
const bookingRoutes = require("./routes/bookings");
app.use("/", authRoutes);
app.use("/dashboard", dashboardRoutes);
app.use("/admin", adminRoutes);
app.use("/bookings", bookingRoutes);

// Root Route
app.get("/", (req, res) => {
    res.redirect("/listings");
});

// Listings
app.get("/listings", isLoggedIn, async (req, res) => {
    // If user is admin, show all listings
    // If user is manager, show all listings
    // If user is regular user, show only approved listings
    let query = {};
    
    if (req.user.role === 'user') {
        query = { isApproved: true };
    }
    
    const allListings = await Listing.find(query).populate('reviews');
    res.render("listings/index", { allListings, currentUser: req.user });
});

app.get("/listings/new", isLoggedIn, isManagerOrAdmin, (req, res) => {
    res.render("listings/new");
});

app.post("/listings", isLoggedIn, isManagerOrAdmin, validateListing, async (req, res) => {
    try {
        const { listing } = req.body;
        const newListing = new Listing({
            ...listing,
            image: {
                url: listing.image,
                filename: "listingimage",
            },
            owner: req.user._id,
            isApproved: false // New listings are not approved by default
        });
        await newListing.save();
        req.flash("success", "New listing created successfully! It will be visible after admin approval.");
        res.redirect(`/listings/${newListing._id}`);
    } catch (err) {
        console.error("Listing Error:", err);
        req.flash("error", "Error creating listing. Please ensure all required fields are filled.");
        res.redirect("/listings/new");
    }
});

app.get("/listings/:id", isLoggedIn, async (req, res) => {
    const { id } = req.params;
    const listing = await Listing.findById(id).populate({
        path: "reviews",
        populate: {
            path: "author"
        }
    });
    
    // Check if listing exists
    if (!listing) {
        req.flash("error", "Listing not found");
        return res.redirect("/listings");
    }
    
    // Check if listing is approved for regular users
    if (req.user.role === 'user' && !listing.isApproved) {
        req.flash("error", "This listing is not available yet. It is pending admin approval.");
        return res.redirect("/listings");
    }
    
    res.render("listings/show", { listing, currentUser: req.user });
});

app.get("/listings/:id/edit", isLoggedIn, isManagerOrAdmin, async (req, res) => {
    const { id } = req.params;
    const listing = await Listing.findById(id);
    if (!listing) {
        req.flash("error", "Listing not found");
        return res.redirect("/listings");
    }
    res.render("listings/edit", { listing });
});

app.put("/listings/:id", isLoggedIn, isManagerOrAdmin, validateListing, async (req, res) => {
    try {
        const { id } = req.params;
        const { listing } = req.body;
        await Listing.findByIdAndUpdate(id, {
            ...listing,
            image: {
                url: listing.image,
                filename: "listingimage",
            },
        });
        req.flash("success", "Listing updated successfully!");
        res.redirect(`/listings/${id}`);
    } catch (err) {
        console.error("Listing Update Error:", err);
        req.flash("error", "Error updating listing. Please ensure all required fields are filled.");
        res.redirect(`/listings/${id}/edit`);
    }
});

app.delete("/listings/:id", isLoggedIn, isManagerOrAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        await Listing.findByIdAndDelete(id);
        req.flash("success", "Listing deleted successfully!");
        res.redirect("/listings");
    } catch (err) {
        console.error("Listing Delete Error:", err);
        req.flash("error", "Error deleting listing. Please try again.");
        res.redirect(`/listings/${id}`);
    }
});

// Reviews
app.post("/listings/:id/reviews", isLoggedIn, validateReview, async (req, res) => {
    try {
        console.log("Review submission received:", req.body);
        
        const listing = await Listing.findById(req.params.id);
        if (!listing) {
            console.log("Listing not found:", req.params.id);
            req.flash("error", "Listing not found");
            return res.redirect("/listings");
        }
        
        console.log("Creating new review with data:", req.body.review);
        const newReview = new Review(req.body.review);
        newReview.author = req.user._id;
        
        console.log("Saving review to database...");
        await newReview.save();
        
        console.log("Adding review to listing...");
        await Listing.findByIdAndUpdate(
            req.params.id,
            { $push: { reviews: newReview._id } },
            { new: true }
        );
        
        console.log("Review added successfully!");
        req.flash("success", "Review added successfully!");
        res.redirect(`/listings/${listing._id}`);
    } catch (err) {
        console.error("Review Error:", err);
        req.flash("error", "Failed to add review. Please try again.");
        res.redirect(`/listings/${req.params.id}`);
    }
});

app.delete("/listings/:id/reviews/:reviewId", isLoggedIn, async (req, res) => {
    try {
        const { id, reviewId } = req.params;
        const review = await Review.findById(reviewId);
        
        if (!review) {
            req.flash("error", "Review not found");
            return res.redirect(`/listings/${id}`);
        }
        
        // Check if the user is the author of the review
        if (!review.author.equals(req.user._id)) {
            req.flash("error", "You don't have permission to delete this review");
            return res.redirect(`/listings/${id}`);
        }
        
        await Listing.findByIdAndUpdate(id, { $pull: { reviews: reviewId } });
        await Review.findByIdAndDelete(reviewId);
        req.flash("success", "Review deleted successfully!");
        res.redirect(`/listings/${id}`);
    } catch (err) {
        console.error("Review Deletion Error:", err);
        req.flash("error", "Failed to delete review. Please try again.");
        res.redirect(`/listings/${req.params.id}`);
    }
});

// Booking
app.post("/listings/:id/book", isLoggedIn, async (req, res) => {
    try {
        const { id } = req.params;
        const { checkIn, checkOut, days, facilities } = req.body;
        
        const listing = await Listing.findById(id);
        if (!listing) {
            req.flash("error", "Listing not found");
            return res.redirect("/listings");
        }

        // Calculate base price
        const basePrice = listing.price * days;
        
        // Calculate facilities price
        const facilityPrices = { ac: 100, wifi: 50 };
        let extraCharge = 0;
        const selectedFacilities = Array.isArray(facilities) ? facilities : facilities ? [facilities] : [];
        selectedFacilities.forEach((f) => {
            extraCharge += facilityPrices[f] || 0;
        });

        // Calculate total price
        const totalPrice = basePrice + extraCharge;

        // Create new booking
        const booking = new Booking({
            user: req.user._id,
            listing: id,
            days,
            checkIn: new Date(checkIn),
            checkOut: new Date(checkOut),
            facilities: selectedFacilities,
            totalPrice,
            status: 'pending'
        });

        await booking.save();

        // Redirect to booking receipt
        res.redirect(`/dashboard/receipt/${booking._id}`);
    } catch (err) {
        console.error("Booking Error:", err);
        req.flash("error", "Failed to create booking. Please try again.");
        res.redirect(`/listings/${req.params.id}`);
    }
});

app.get("/listings/:id/receipt", isLoggedIn, async (req, res) => {
    const { id } = req.params;
    const listing = await Listing.findById(id);
    res.render("listings/receipt", { listing, currentUser: req.user });
});

// Error handling
app.all("*", (req, res, next) => {
    next(new ExpressError(404, "Page Not Found"));
});

app.use((err, req, res, next) => {
    const { statusCode = 500, message = "Something went wrong!" } = err;
    res.status(statusCode).send(message);
});

// Start server
app.listen(8080, () => {
    console.log("Server is listening on port 8080");
});
