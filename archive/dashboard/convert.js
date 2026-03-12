const csvToJson = require('convert-csv-to-json')

const input = './poi_county_cleaned.csv'
const output = './poi_county_cleaned.json'

csvToJson.fieldDelimiter(',').formatValueByType().generateJsonFileFromCsv(input, output)