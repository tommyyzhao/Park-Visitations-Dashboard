import React from "react"
import MapComponent from "./components/MapComponent/MapComponent"
import AutoComplete from "./components/AutoComplete/AutoComplete"

import logo from './logo.svg'
import "./App.scss";
import Grid from '@material-ui/core/Grid';


class App extends React.Component {

  // Function for setting search parameters
  setSearch = (params) => {
    let newParams = {};
    // check if searchTerms has been updated
    if (params.searchTerms) {
      newParams['searchTerms'] = params.searchTerms;
    }
    if (params.searchTerms === '') {
      newParams['searchTerms'] = ' ';
    }
    if (newParams) {
      this.setState(newParams);
    }
  }
  
  render() {
    return (
      // Render components in a Grid
      <Grid container spacing={0} style={{ 'height': '100vh' }}>
        <Grid item xs={9}>
          <MapComponent /> 
        </Grid>
        <Grid item xs={3} >
          <Grid container spacing={0}>
            <Grid item xs={12}>
              <AutoComplete
                setSearch={this.setSearch} />
            </Grid>
            <Grid item xs={12} style={{ 'height': '100%' }}>
              <header className="App-header">
                <img src={logo} className="App-logo" alt="logo" />
                <p>
                  Charts & stuff should go here
                </p>
              </header>
            </Grid>
          </Grid>
        </Grid>
      </Grid>
    );
  }
}

export default (App)
