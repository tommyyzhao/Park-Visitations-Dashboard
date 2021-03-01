import React from "react"
import MapComponent from "./components/MapComponent/MapComponent"

import logo from './logo.svg'
import "./App.scss";

import Grid from '@material-ui/core/Grid';


class App extends React.Component {

  
  render() {
    return (
      
      <Grid container spacing={0} style={{ 'height': '100vh' }}>
        <Grid item xs={9}>
          <MapComponent />
        </Grid>
        <Grid item xs={3} >
            <header className="App-header">
              <img src={logo} className="App-logo" alt="logo" />
              <p>
                Edit <code>src/App.js</code> and save to reload.
              </p>
            </header>
        </Grid>
      </Grid>
    );
  }
}

export default (App)
