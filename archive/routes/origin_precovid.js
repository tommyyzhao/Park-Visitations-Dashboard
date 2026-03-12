const router = require('express').Router()
let OriginPreCovid = require('../models/origin_precovid.model')

router.route('/:id').get((req, res) => {
    OriginPreCovid.findOne({safegraph_place_id: req.params.id})
            .then(origin_data => res.json(origin_data))
            .catch(err => res.status(400).json('Error: ' + err))
})

module.exports = router