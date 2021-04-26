import React from "react"
import {Container, Row, Col, ButtonGroup, ToggleButton} from 'react-bootstrap'
import TitleBar from "./components/TitleBar/TitleBar"
import MainChart from "./components/MainChart/MainChart"
import MapComponent from "./components/MapComponent/MapComponent"
import AutoComplete from "./components/AutoComplete/AutoComplete"
import CountySearch from "./components/CountySearch/CountySearch"
import Fuse from "fuse.js"
import axios from 'axios'

import "./App.scss";
import {Tab,Tabs,TabList,TabPanel} from 'react-tabs';
import './react-tabs.scss';

class App extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      parkLng: -97,
      parkLat: 38,
      selectedParkId: null,
      selectedParkName: "select a park",
      chartMode: "line",
      showArcsMode: "postcovid",
      parkVisitations:  {},
      originCovidCensus: {}
    };
    this.poi_database = new Fuse(require("./data/park_pois.json"), {
      keys: ['safegraph_place_id'],
      shouldSort: false,
      minMatchCharLength: 10,
      threshold: 0.0
    })
    this.radios = [
      { name: 'Line', value: 'line' },
      { name: 'Overlay', value: 'overlay' },
      { name: 'VisitorOrigin', value: 'origin' },
    ];
    this.radiosArcSettings = [
      { name: 'Off', value: 'off' },
      //{ name: 'Pre-Covid', value: 'precovid' },
      { name: 'On', value: 'postcovid' }
    ];
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

  getOriginCovidData = (id) => {
    axios.get(`/origincovid/${id}`)
      .then((response) => {
        const data = response.data
        console.log('Origin data (covid) received')
        console.log(data)
        this.setState({ originCovidCensus: data})
      })
      .catch(() => {
        console.log('Error retrieving origin (covid-era) data')
      })
  }

  // Function for setting search parameters
  setSearch = (params) => {
    let newParams = {};
    // check if searchTerms has been updated
    if (params.selectedParkId && params.selectedParkId !== this.state.selectedParkId && params.selectedParkId !== -1) {
      console.log('New park id received')
      newParams['selectedParkId'] = params.selectedParkId
      // get visitations data for selected park
      this.getOriginCovidData(params.selectedParkId)
      this.getVisitationsData(params.selectedParkId)
    }
    // in case park visitations is passed directly to setSearch
    if (params.parkVisitations) { newParams['parkVisitations'] = params.parkVisitations }
    if (params.selectedParkName) { newParams['selectedParkName'] = params.selectedParkName }
    if (newParams) {
      this.setState(newParams)
    }
  }
  
  componentDidUpdate(prevProps, prevState) {
    // load POI info for park
    // if parkId is -1 then that means a county is selected so don't query mongo
    if (this.state.selectedParkId !== prevState.selectedParkId || !this.state.selectedParkId === -1) {
    //console.log("Park id (state) changed, searching for park's POI info:")
      let park_info = this.poi_database.search(this.state.selectedParkId)[0].item
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
      <Container fluid>
        <TitleBar />
        <Row style={{'maxHeight': '95vh', 'overflowY': 'scroll'}}>
          <Col xs={12} sm={5} md={4} lg={3}>
            <Row>
              <Tabs defaultIndex={0} onSelect={index => console.log(index)} >
                <TabList >
                  <Tab><h2>Park Search</h2></Tab>
                  <Tab><h2>County Search</h2></Tab>
                </TabList>

                <TabPanel style={{margin: "20px 0 0 0"}}>
                  <Container fluid>
                    <AutoComplete
                      selectedParkId={this.state.selectedParkId}
                      setSearch={this.setSearch} />
                  </Container>
                </TabPanel> 
                <TabPanel style={{margin: "20px 0 0 0"}}>
                  <Container fluid>
                      <CountySearch
                        selectedParkId={this.state.selectedParkId}
                        setSearch={this.setSearch} />
                  </Container>
                </TabPanel>    
              </Tabs>
            </Row>
            <Row xs={4} style={{'padding': '5px', margin:"10px 0px 0px 0px"}} className="justify-content-md-left">
              <h4>Visitor-origin arc setting:</h4>
              <Col>
                <ButtonGroup toggle style={{'width': '100%'}}>
                  {this.radiosArcSettings.map((radio, idx) => (
                    <ToggleButton size="lg"
                      key={idx}
                      type="radio"
                      variant="primary"
                      name="radio"
                      value={radio.value}
                      checked={this.state.showArcsMode === radio.value}
                      onChange={(e) => this.setState({showArcsMode: e.currentTarget.value})}
                    >
                      {radio.name}
                    </ToggleButton>
                  ))}
                </ButtonGroup>
              </Col>
            </Row>
            <Row xs={4} style={{'padding': '5px', margin:"0px 0px 10px 0px"}} className="justify-content-md-left">
              <h4>Chart type:</h4>
              <Col>
                <ButtonGroup toggle >
                  {this.radios.map((radio, idx) => (
                    <ToggleButton size="lg"
                      key={idx}
                      type="radio"
                      variant="primary"
                      name="radio"
                      value={radio.value}
                      checked={this.state.chartMode === radio.value}
                      onChange={(e) => this.setState({chartMode: e.currentTarget.value})}
                    >
                      {radio.name}
                    </ToggleButton>
                  ))}
                </ButtonGroup>
              </Col>
            </Row>
            <Row>
              <MainChart chartMode = {this.state.chartMode} parkName={this.state.selectedParkName} parkData={this.state.parkVisitations}/>
            </Row>    
          </Col>
          <Col xs={12} sm={7} md={8} lg={9} style={{ 'marginBottom': '40px'}}>
            {this.state && this.state.selectedParkId && <div className="sidebar-selected">Selected park: {this.state.selectedParkName}</div>}
            <MapComponent parkLng={this.state.parkLng} parkLat={this.state.parkLat} originCovidData={this.state.originCovidCensus} showArcsMode={this.state.showArcsMode} setSearch={this.setSearch}/>
          </Col>
        </Row>
      </Container>
      
    );
  }
}

export default (App)
