const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const reviewSchema = new Schema({
    comment: String, // Corrected 'commnet' to 'comment'
    rating: {
        type: Number,
        min: 1,
        max: 5
    },
    author: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Export the model, but only create it if it doesn't already exist
module.exports = mongoose.models.Review || mongoose.model("Review", reviewSchema);