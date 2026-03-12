const mongoose = require('mongoose')

const Schema = mongoose.Schema

const originCovidSchema = new Schema({}, {strict: false})

const OriginCovid = mongoose.model('origin_covid', originCovidSchema, 'origin_covid')

module.exports = OriginCovid