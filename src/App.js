import React from "react"
import TitleBar from "./components/TitleBar/TitleBar"
import VisitationChart from "./components/VisitationChart/VisitationChart"
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
    //console.log(this.state)
    return (
      // Render components in a Grid
      <div>
        <TitleBar />
        <Grid container spacing={0} style={{ 'height': '100vh' }}>
          <Grid item xs={3} >
            <Grid container spacing={5}>
              <Grid item xs={12}>
                <Grid container spacing={3}>
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
                <VisitationChart />
              </Grid>
            </Grid>
          </Grid>
          <Grid item xs={9}>
            {this.state && this.state.selectedPark && this.state.selectedPark.name_location && <div className="sidebar-selected">Selected park: {this.state.selectedPark.name_location}</div>}
            <MapComponent />
          </Grid>
        </Grid>
      </div>
    );
  }
}

export default (App)
