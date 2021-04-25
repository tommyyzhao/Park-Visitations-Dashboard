const express = require('express')
const cors = require('cors')
const mongoose = require('mongoose')

require('dotenv').config()

const app = express()
const port = process.env.PORT || 5000

app.use(cors())
app.use(express.json())


mongoose.connect(process.env.ATLAS_URI, { useNewUrlParser: true, useUnifiedTopology: true })
const connection = mongoose.connection
connection.once('open', () => {
    console.log("MongoDB connected successfully")
})

const visitationsRouter = require('./routes/visitations')
const originCovidRouter = require('./routes/origin_covid')

app.use('/visitations', visitationsRouter)
app.use('/origincovid', originCovidRouter)

if (process.env.NODE_ENV === 'production') {
    app.use(express.static('dashboard/build'))
    console.log('API in production mode')
}

app.listen(port, () => {
    console.log(`Server is running on port: ${port}`)
})