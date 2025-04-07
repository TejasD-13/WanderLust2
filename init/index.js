const sampleListings = require("./data.js");
const Listing = require("../models/listing.js");
const mongoose = require("mongoose");

mongoose.connect("mongodb://127.0.0.1:27017/wanderlust", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log("MongoDB Connected Successfully"))
  .catch((err) => console.error("MongoDB Connection Error:", err));

const initDB = async () => {
  try {
    await Listing.deleteMany({});
    await Listing.insertMany(sampleListings.data);
    console.log("Data was initialized successfully");
  } catch (err) {
    console.error("Error initializing data:", err);
  } finally {
    mongoose.connection.close(); // Close the connection after initialization
  }
};

initDB();
