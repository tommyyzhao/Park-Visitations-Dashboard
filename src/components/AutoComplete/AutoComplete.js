import React from 'react';
import Autosuggest from 'react-autosuggest';
import Fuse from "fuse.js"
import Typography from '@material-ui/core/Typography';
import Box from '@material-ui/core/Box';
//import { debounce } from 'throttle-debounce';
import './styles.scss';

class AutoComplete extends React.Component {
    state = {
        value: '',
        suggestions: []
    }

    constructor(props) {
        super(props);
        // initialize Fuse database with Park POI data
        this.database = new Fuse(require("../../data/park_pois.json"), {
            keys: ["name_location"],
            shouldSort: true,
            minMatchCharLength: 1
        })
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

   
    onKeyUp = (e) => {
         // when Enter button is pressed
        if (e.charCode === 13 || e.keyCode === 13) {
            // return the Park POI object
            let park_info = this.database.search(this.state.value)[0].item
            this.props.setSearch({ selectedPark: park_info })
        }
    }

    // function to get suggestions from park database
    onSuggestionsFetchRequested = ({ value }) => {
        let results = []
        let data = this.database.search(value).slice(0, 6)
        for (let i = 0; i < data.length; i++) {
            results.push(data[i].item.name_location);
        }
        this.setState({ suggestions: results })
    }

    onSuggestionsClearRequested = () => {
        this.setState({ suggestions: [] })
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
                <Box className="BoxText" fontWeight="fontWeightBold">Park Search</Box>
                <Autosuggest
                    suggestions={suggestions}
                    onSuggestionsFetchRequested={this.onSuggestionsFetchRequested}
                    onSuggestionsClearRequested={this.onSuggestionsClearRequested}
                    getSuggestionValue={suggestion => suggestion}
                    renderSuggestion={this.renderSuggestion}
                    inputProps={inputProps}
                />
            </Typography>
        )
    }
}

export default AutoComplete;