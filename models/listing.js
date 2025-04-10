const mongoose = require("mongoose");
const Schema = mongoose.Schema;

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
  isApproved: {
    type: Boolean,
    default: false
  }
});

// Use mongoose.model.models to check if Review model exists before using it
listingSchema.post("findOneAndDelete", async(listing)=>{
  if(listing) {
    // Check if Review model exists before using it
    if (mongoose.models.Review) {
      await mongoose.models.Review.deleteMany({_id: {$in: listing.reviews}});
    }
  }
})

// Export the model, but only create it if it doesn't already exist
module.exports = mongoose.models.Listing || mongoose.model("Listing", listingSchema);
