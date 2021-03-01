import React from 'react';
import Autosuggest from 'react-autosuggest';
import Typography from '@material-ui/core/Typography';
import Box from '@material-ui/core/Box';
//import { debounce } from 'throttle-debounce';
import './styles.scss';

class AutoComplete extends React.Component {
    state = {
        value: '',
        suggestions: []
    }

    componentDidMount() {
        /*
        this.onSuggestionsFetchRequested = debounce(
            500,
            this.onSuggestionsFetchRequested
        )*/
    }

    renderSuggestion = suggestion => {
        return (
            <div className="result">
                <div>{suggestion}</div>
            </div>
        )
    }

    onChange = (event, { newValue }) => {
        this.setState({ value: newValue });
    }

    onKeyUp = (e) => {
        if (e.charCode === 13 || e.keyCode === 13) {
            this.props.setSearch({ searchTerms: this.state.value });
        }
    }

    onSuggestionsFetchRequested = ({ value }) => {
        let url ='&c=';
        fetch(url)
            .then(res => res.json())
            .then(data => {
                let results = [];
                for (let i = 0; i < data.length; i++) {
                    results.push(data[i]);
                }
                this.setState({ suggestions: results });
            })
            .catch(err => {
                // Do something for an error here
                console.log("Error Reading data " + err);
            });
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