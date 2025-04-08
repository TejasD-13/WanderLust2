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

const isLoggedIn = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect("/login");
};

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

// Auth Routes
const authRoutes = require("./routes/auth");
const dashboardRoutes = require("./routes/dashboard");
app.use("/", authRoutes);
app.use("/dashboard", dashboardRoutes);

// Root Route
app.get("/", (req, res) => {
    res.redirect("/login");
});

// Listings
app.get("/listings", isLoggedIn, async (req, res) => {
    const allListings = await Listing.find({});
    res.render("listings/index", { allListings });
});

app.get("/listings/new", isLoggedIn, (req, res) => {
    res.render("listings/new");
});

app.post("/listings", isLoggedIn, async (req, res) => {
    try {
        const { listing } = req.body;
        const newListing = new Listing({
            ...listing,
            image: {
                url: listing.image,
                filename: "listingimage",
            },
            owner: req.user._id,
        });
        await newListing.save();
        res.redirect(`/listings/${newListing._id}`);
    } catch (err) {
        console.error(err);
        res.send("Error creating listing. Please ensure all required fields are filled.");
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
    res.render("listings/show", { listing, currentUser: req.user });
});

app.get("/listings/:id/edit", isLoggedIn, async (req, res) => {
    try {
        const { id } = req.params;
        const listing = await Listing.findById(id);
        res.render("listings/edit", { listing });
    } catch (err) {
        console.error(err);
        res.send("Listing not found.");
    }
});

app.put("/listings/:id", isLoggedIn, async (req, res) => {
    try {
        const { id } = req.params;
        const { listing } = req.body;
        const updatedListing = {
            ...listing,
            image: {
                url: listing.image,
                filename: "listingimage",
            },
        };
        await Listing.findByIdAndUpdate(id, updatedListing);
        res.redirect(`/listings/${id}`);
    } catch (err) {
        console.error(err);
        res.send("Error updating the listing. Please try again.");
    }
});

app.delete("/listings/:id", isLoggedIn, async (req, res) => {
    const { id } = req.params;
    await Listing.findByIdAndDelete(id);
    res.redirect("/listings");
});

// Reviews
app.post("/listings/:id/reviews", isLoggedIn, async (req, res) => {
    try {
        const listing = await Listing.findById(req.params.id);
        const newReview = new Review(req.body.review);
        newReview.author = req.user._id;
        listing.reviews.push(newReview);
        await newReview.save();
        await listing.save();
        req.flash("success", "Review added successfully!");
        res.redirect(`/listings/${listing._id}`);
    } catch (err) {
        console.error("Review Error:", err);
        req.flash("error", "Failed to add review. Please try again.");
        res.redirect(`/listings/${req.params.id}`);
    }
});

app.delete("/listings/:id/reviews/:reviewId", isLoggedIn, async (req, res) => {
    const { id, reviewId } = req.params;
    await Listing.findByIdAndUpdate(id, { $pull: { reviews: reviewId } });
    await Review.findByIdAndDelete(reviewId);
    res.redirect(`/listings/${id}`);
});

// Booking
app.post("/listings/:id/book", isLoggedIn, async (req, res) => {
    const { id } = req.params;
    const { days, facilities } = req.body;
    const listing = await Listing.findById(id);
    if (!listing) return res.send("Listing not found.");

    const basePrice = listing.price * days;
    const facilityPrices = { ac: 100, wifi: 50 };
    let extraCharge = 0;

    const selectedFacilities = Array.isArray(facilities)
        ? facilities
        : facilities
        ? [facilities]
        : [];

    selectedFacilities.forEach((f) => {
        extraCharge += facilityPrices[f] || 0;
    });

    const totalPrice = basePrice + extraCharge;

    const booking = new Booking({
        user: req.user._id,
        listing: id,
        days,
        checkIn: new Date(),
        checkOut: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
        facilities: selectedFacilities,
        totalPrice,
    });

    await booking.save();

    res.render("listings/receipt", {
        listing,
        bookingReceipt: {
            days,
            facilities: selectedFacilities,
            basePrice: listing.price,
            total: totalPrice,
        },
    });
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
