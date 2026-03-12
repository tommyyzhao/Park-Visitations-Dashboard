const mongoose = require('mongoose')

const Schema = mongoose.Schema

const originPreCovidSchema = new Schema({}, {strict: false})

const OriginPreCovid = mongoose.model('origin_precovid', originPreCovidSchema, 'origin_precovid')

module.exports = OriginPreCovid