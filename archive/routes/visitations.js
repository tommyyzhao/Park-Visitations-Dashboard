const router = require('express').Router()
let Visitations = require('../models/visitations.model')

router.route('/:id').get((req, res) => {
    Visitations.findOne({safegraph_place_id: req.params.id})
            .then(visitation => res.json(visitation))
            .catch(err => res.status(400).json('Error: ' + err))
})

module.exports = router