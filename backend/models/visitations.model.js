const mongoose = require('mongoose')

const Schema = mongoose.Schema

const visitationsSchema = new Schema({
    safegraph_place_id: { type: String, required: true, unique: true },
    "1/1/2018": { type: Number },
    "2/1/2018": { type: Number },
    "3/1/2018": { type: Number },
    "4/1/2018": { type: Number },
    "5/1/2018": { type: Number },
    "6/1/2018": { type: Number },
    "7/1/2018": { type: Number },
    "8/1/2018": { type: Number },
    "9/1/2018": { type: Number },
    "10/1/2018": { type: Number },
    "11/1/2018": { type: Number },
    "12/1/2018": { type: Number },
    "1/1/2019": { type: Number },
    "2/1/2019": { type: Number },
    "3/1/2019": { type: Number },
    "4/1/2019": { type: Number },
    "5/1/2019": { type: Number },
    "6/1/2019": { type: Number },
    "7/1/2019": { type: Number },
    "8/1/2019": { type: Number },
    "9/1/2019": { type: Number },
    "10/1/2019": { type: Number },
    "11/1/2019": { type: Number },
    "12/1/2019": { type: Number },
    "1/1/2020": { type: Number },
    "2/1/2020": { type: Number },
    "3/1/2020": { type: Number },
    "4/1/2020": { type: Number },
    "5/1/2020": { type: Number },
    "6/1/2020": { type: Number },
    "7/1/2020": { type: Number },
    "8/1/2020": { type: Number },
    "9/1/2020": { type: Number },
    "10/1/2020": { type: Number },
    "11/1/2020": { type: Number },
    "12/1/2020": { type: Number },
    "1/1/2021": { type: Number },
    "2/1/2021": { type: Number },
})

const Visitations = mongoose.model('visitations', visitationsSchema)

module.exports = Visitations