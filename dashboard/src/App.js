import React from "react"
import TitleBar from "./components/TitleBar/TitleBar"
//import VisitationChart from "./components/VisitationChart/VisitationChart"
import OverlayChart from "./components/OverlayChart/OverlayChart"
import MapComponent from "./components/MapComponent/MapComponent"
import AutoComplete from "./components/AutoComplete/AutoComplete"
import Fuse from "fuse.js"
import axios from 'axios'

//import logo from './logo.svg' // commented out to stop compile warning
import "./App.scss";
import Grid from '@material-ui/core/Grid';

import {Tab,Tabs,TabList,TabPanel} from 'react-tabs';
import './react-tabs.scss';

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
    this.poi_database = new Fuse(require("./data/park_pois.json"), {
      keys: ['safegraph_place_id'],
      shouldSort: false,
      minMatchCharLength: 10,
      threshold: 0.0
    })
  }

  getVisitationsData = (id) => {
    axios.get(`/visitations/${id}`)
      .then((response) => {
        const data = response.data
        console.log('Visitation data received')
        this.setState({ parkVisitations: data})
      })
      .catch(() => {
        console.log('Error retrieving visitations data')
      })
  }

  // Function for setting search parameters
  setSearch = (params) => {
    let newParams = {};
    // check if searchTerms has been updated
    if (params.selectedParkId && params.selectedParkId !== this.state.selectedParkId) {
      console.log('New park id received')
      newParams['selectedParkId'] = params.selectedParkId
      // get visitations data for selected park
      this.getVisitationsData(params.selectedParkId)
    }
    if (newParams) {
      this.setState(newParams)
    }
  }
  
  componentDidUpdate(prevProps, prevState) {
    // load POI info for park
    if (this.state.selectedParkId !== prevState.selectedParkId) {
      console.log("Park id (state) changed, searching for park's POI info:")
      let park_info = this.poi_database.search(this.state.selectedParkId)[0].item
      console.log(park_info)
      this.setState({
        parkLng: park_info.longitude,
        parkLat:park_info.latitude,
        selectedParkName: park_info.location_name
      })
    }
  }

  render() {
    return (
      // Render components in a Grid
      <div>
        <TitleBar />
        <Tabs defaultIndex={0} onSelect={index => console.log(index)}>
          <TabList>
            <Tab>Tab 1</Tab>
            <Tab>Tab 2</Tab>
          </TabList>

          <TabPanel>
            <Grid container spacing={0} style={{ 'height': '100vh' }}>
              <Grid item xs={3} >
                <Grid container spacing={5}>
                  <Grid item xs={9}>
                    <Grid container spacing={3}>
                      <Grid item xs={12}>
                        <AutoComplete
                          selectedParkId={this.state.selectedParkId}
                          setSearch={this.setSearch} />
                      </Grid>
                    </Grid>

                  </Grid>
                  <Grid item xs={12} style={{ 'height': '100%' }}>
                    <OverlayChart parkId={this.state.selectedParkId} parkName={this.state.selectedParkName} parkData={this.state.parkVisitations}/>
                  </Grid>
                </Grid>
              </Grid>
              <Grid item xs={9}>
                {this.state && this.state.selectedParkId && <div className="sidebar-selected">Selected park: {this.state.selectedParkName}</div>}
                <MapComponent parkLng={this.state.parkLng} parkLat={this.state.parkLat} setSearch={this.setSearch}/>
              </Grid>
            </Grid>
          </TabPanel>
          <TabPanel>
            <p>Tab 2</p>
          </TabPanel>
        </Tabs>
      </div>
    );
  }
}

export default (App)
