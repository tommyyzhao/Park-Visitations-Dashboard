import React from "react"
import TitleBar from "./components/TitleBar/TitleBar"
import VisitationChart from "./components/VisitationChart/VisitationChart"
import MapComponent from "./components/MapComponent/MapComponent"
import AutoComplete from "./components/AutoComplete/AutoComplete"
import CustomizedSlider from "./components/TimeSlider/TimeSlider"
import axios from 'axios'

//import logo from './logo.svg' // commented out to stop compile warning
import "./App.scss";
import Grid from '@material-ui/core/Grid';



class App extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      parkLng: -97,
      parkLat: 38,
      selectedParkId: null,
      selectedParkName: " ",
      parkVisitations: {}
    };

  }

  getVisitationsData = (id) => {
    axios.get(`/visitations/${id}`)
      .then((response) => {
        const data = response.data
        this.setState({ parkVisitations: data})
        console.log('Visitation data received')
        console.log(data)
      })
      .catch(() => {
        alert('Error retrieving visitations data')
      })
  }

  // Function for setting search parameters
  setSearch = (params) => {
    let newParams = {};
    // check if searchTerms has been updated
    if (params.selectedPark) {
      newParams['selectedPark'] = params.selectedPark
      newParams['selectedParkName'] = params.selectedPark.location_name
      newParams['parkLng'] = params.selectedPark.longitude
      newParams['parkLat'] = params.selectedPark.latitude
      newParams['selectedParkId'] = params.selectedPark.safegraph_place_id
    } // separate if statement to check if MapComponent updated the selected park
    else if (params.selectedParkId) {
      newParams['selectedParkId'] = params.selectedParkId
    }
    if (newParams) {
      this.setState(newParams)
      this.getVisitationsData(newParams['selectedParkId'])
    }
  }

  render() {
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
                      selectedParkId={this.state.selectedParkId}
                      setSearch={this.setSearch} />
                  </Grid>
                  <Grid item xs={12}>
                    <CustomizedSlider
                      setSearch={this.setSearch} />
                  </Grid>
                </Grid>

              </Grid>
              <Grid item xs={12} style={{ 'height': '100%' }}>
                <VisitationChart parkId={this.state.selectedParkId} parkName={this.state.selectedParkName}/>
              </Grid>
            </Grid>
          </Grid>
          <Grid item xs={9}>
            {this.state && this.state.selectedPark && this.state.selectedPark.location_name && <div className="sidebar-selected">Selected park: {this.state.selectedPark.location_name}</div>}
            <MapComponent parkLng={this.state.parkLng} parkLat={this.state.parkLat} setSearch={this.setSearch}/>
          </Grid>
        </Grid>
      </div>
    );
  }
}

export default (App)
