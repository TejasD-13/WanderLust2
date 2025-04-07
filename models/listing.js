const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const Review = require("./reviews.js"); // Correct file name if it's 'reviews.js'const reviews = require("./reviews");
const listingSchema = new mongoose.Schema({
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: String,
  description: String,
  image: {
    url: String,
    filename: String
  },
  price: Number,
  location: String,
  country: String,
  bedroom: Number,
  beds: Number,
  acAvailable: Boolean,
  fanAvailable: Boolean,
  reviews: [
    {
        type: Schema.Types.ObjectId,
        ref: "Review"
    },
  ],
});

listingSchema.post("findOneAndDelete", async(listing)=>{
  if(listing) {
    await Review.deleteMany({_id: {$in: listing.reviews}});
  }
})

const Listing = mongoose.model("Listing", listingSchema);

module.exports = Listing;
