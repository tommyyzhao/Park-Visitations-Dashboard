import React from 'react';
import Autosuggest from 'react-autosuggest';
import Fuse from "fuse.js"
import Typography from '@material-ui/core/Typography';
import Box from '@material-ui/core/Box';
//import { debounce } from 'throttle-debounce';
import './styles.scss';

class CountySearch extends React.Component {
    state = {
        value: '',
        suggestions: []
    }

    constructor(props) {
        super(props);
        // initialize Fuse database with Park POI data
        this.database = new Fuse(require("../../data/poi_idname_only_compact.json"), {
            keys: ['name_location'],
            shouldSort: true,
            threshold: 0.2,
            minMatchCharLength: 3
        })
        this.onSuggestionSelected = this.onSuggestionSelected.bind(this)
      }

    renderSuggestion = suggestion => {
        return (
            <div className="result">
                <div>{suggestion}</div>
            </div>
        )
    }

    onChange = (event, { newValue }) => {
        this.setState({ value: newValue })
    }

    // function to get suggestions from park database
    onSuggestionsFetchRequested = ({ value }) => {
        // some bool checks to optimize when values are searched
        if (value.length < 5 || value.length%2===0 || value.length <= this.state.prevVal.length){ 
            this.setState({prevVal: value})
            return
        }
        let results = []
        let data = this.database.search(value).slice(0, 10)
        for (let i = 0; i < data.length; i++) {
            results.push(data[i].item.name_location);
        }
        this.setState({ 
            suggestions: results,
            prevVal: value
        })
    }

    onSuggestionsClearRequested = () => {
        this.setState({ suggestions: [] })
    }

    onSuggestionSelected(event, { suggestionValue }) {
        let park_info = this.database.search(suggestionValue)[0].item
        try {
            this.props.setSearch({ selectedParkId: park_info.safegraph_place_id })
        } catch (e) {
            console.error(e)
        } finally {
            console.log("Sent suggested park id")
        }       
      }

    render() {
        const { value, suggestions } = this.state

        const inputProps = {
            placeholder: 'Search',
            value,
            onChange: this.onChange,
            onKeyUp: this.onKeyUp,
        }

        return (
            <Typography component="div">
                <Box className="BoxText" fontWeight="fontWeightBold">County Search</Box>
                <Autosuggest
                    suggestions={suggestions}
                    onSuggestionsFetchRequested={this.onSuggestionsFetchRequested}
                    onSuggestionsClearRequested={this.onSuggestionsClearRequested}
                    onSuggestionSelected={this.onSuggestionSelected}
                    getSuggestionValue={suggestion => suggestion}
                    renderSuggestion={this.renderSuggestion}
                    inputProps={inputProps}
                />
            </Typography>
        )
    }
}

export default CountySearch;