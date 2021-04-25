const router = require('express').Router()
let OriginCovid = require('../models/origin_covid.model')

router.route('/:id').get((req, res) => {
    OriginCovid.findOne({safegraph_place_id: req.params.id})
            .then(origin_data => res.json(origin_data))
            .catch(err => res.status(400).json('Error: ' + err))
})

module.exports = router