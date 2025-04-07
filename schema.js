const Joi = require("joi");

module.exports.listingSchema = Joi.object({
    listing: Joi.object({
        title: Joi.string().required(),
        desciption: Joi.string().required(),
        location: Joi.string().required(),
        country: Joi.string().required(),
        price: Joi.string().required(),
        image: Joi.string().allow("",null),
        bedrooms: Joi.number().required(),
        beds: Joi.number().required(),
        acAvailable: Joi.boolean(),
        fanAvailable: Joi.boolean()
    }).required(),
})

module.exports.reviewSchema = Joi.object({
    review: Joi.object({
        rating: Joi.number().required(),
        Comment: Joi.string().required()
    }).required()
})