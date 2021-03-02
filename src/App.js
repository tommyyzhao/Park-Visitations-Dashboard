import React from "react"
import MapComponent from "./components/MapComponent/MapComponent"
import AutoComplete from "./components/AutoComplete/AutoComplete"
import CustomizedSlider from "./components/TimeSlider/TimeSlider"

import logo from './logo.svg'
import "./App.scss";
import Grid from '@material-ui/core/Grid';


class App extends React.Component {

  // Function for setting search parameters
  setSearch = (params) => {
    let newParams = {};
    // check if searchTerms has been updated
    if (params.selectedPark) {
      newParams['selectedPark'] = params.selectedPark;
    }
    if (newParams) {
      console.log(newParams)
      this.setState(newParams);
    }
  }
  
  render() {
    console.log(this.state)
    return (
      // Render components in a Grid
      <Grid container spacing={0} style={{ 'height': '100vh' }}>
        {this.state !== null && this.state.selectedPark !== null && <div className="sidebar-selected">Selected park: {this.state.selectedPark.name_location}</div>}
        <Grid item xs={9}>
          <MapComponent /> 
        </Grid>
        <Grid item xs={3} >
          <Grid container spacing={0}>
            <Grid item xs={12}>
              <Grid container spacing={1}>
                <Grid item xs={12}>
                  <AutoComplete
                    setSearch={this.setSearch} />
                </Grid>
                <Grid item xs={12}>
                  <CustomizedSlider
                    setSearch={this.setSearch} />
                </Grid>
              </Grid>
              
            </Grid>
            <Grid item xs={12} style={{ 'height': '100%' }}>
              <header className="App-header">
                <img src={logo} className="App-logo" alt="logo" />
                <p>
                  Charts 'n stuff should go here
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
