import React from "react"
import TitleBar from "./components/TitleBar/TitleBar"
import VisitationChart from "./components/VisitationChart/VisitationChart"
import OverlayChart from "./components/OverlayChart/OverlayChart"
import MapComponent from "./components/MapComponent/MapComponent"
import AutoComplete from "./components/AutoComplete/AutoComplete"
import CountySearch from "./components/CountySearch/CountySearch"
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
      chartTabIndex: 0,
      parkVisitations:  {
        "safegraph_place_id": "sg:000024a5035444a2aa1ae7594937e4fc",
        "2018-01-01": 33,
        "2018-02-01": 33,
        "2018-03-01": 56,
        "2018-04-01": 35,
        "2018-05-01": 49,
        "2018-06-01": 73,
        "2018-07-01": 117,
        "2018-08-01": 87,
        "2018-09-01": 70,
        "2018-10-01": 74,
        "2018-11-01": 52,
        "2018-12-01": 14,
        "2019-01-01": 26,
        "2019-02-01": 25,
        "2019-03-01": 33,
        "2019-04-01": 48,
        "2019-05-01": 109,
        "2019-06-01": 66,
        "2019-07-01": 100,
        "2019-08-01": 68,
        "2019-09-01": 68,
        "2019-10-01": 55,
        "2019-11-01": 48,
        "2019-12-01": 45,
        "2020-01-01": 43,
        "2020-02-01": 34,
        "2020-03-01": 51,
        "2020-04-01": 69,
        "2020-05-01": 96,
        "2020-06-01": 123,
        "2020-07-01": 109,
        "2020-08-01": 81,
        "2020-09-01": 83,
        "2020-10-01": 62,
        "2020-11-01": 43,
        "2020-12-01": 56,
        "2021-01-01": 11,
        "2021-02-01": 10
       }
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
            <Grid container spacing={0} style={{ 'height': '100vh' }}>
              <Grid item xs={3} >
                <Tabs defaultIndex={0} onSelect={index => console.log(index)}>
                  <TabList>
                    <Tab>Park Search</Tab>
                    <Tab>County Search</Tab>
                  </TabList>

                  <TabPanel>
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
                        <Tabs selectedIndex={this.chartTabIndex} onSelect={index => this.setState({chartTabIndex: index})} className="second">
                          <TabList>
                            <Tab>Monthly Visitations</Tab>
                            <Tab>Pre-Covid/Post-Covid Visitations</Tab>
                          </TabList>
                          <TabPanel >
                            <OverlayChart parkId={this.state.selectedParkId} parkName={this.state.selectedParkName} parkData={this.state.parkVisitations}/>
                          </TabPanel>
                          <TabPanel >
                            <VisitationChart parkId={this.state.selectedParkId} parkName={this.state.selectedParkName} parkData={this.state.parkVisitations}/>
                          </TabPanel>
                        </Tabs>
                      </Grid>
                    </Grid>
                  </TabPanel>          
                  <TabPanel>
                    <Grid item xs={9}>
                        <Grid container spacing={3}>
                          <Grid item xs={12}>
                            <CountySearch
                              selectedParkId={this.state.selectedParkId}
                              setSearch={this.setSearch} />
                          </Grid>
                        </Grid>
                      </Grid>
                  </TabPanel>
                </Tabs>
              </Grid>
              <Grid item xs={9}>
                {this.state && this.state.selectedParkId && <div className="sidebar-selected">Selected park: {this.state.selectedParkName}</div>}
                <MapComponent parkLng={this.state.parkLng} parkLat={this.state.parkLat} setSearch={this.setSearch}/>
              </Grid>
            </Grid>
        
      </div>
    );
  }
}

export default (App)
