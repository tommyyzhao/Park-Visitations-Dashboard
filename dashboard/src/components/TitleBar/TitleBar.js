import React from "react"
import Navbar from 'react-bootstrap/Navbar';

function TitleBar() {
    return (
      <Navbar bg="primary">
        <img
              alt="PSU logo"
              src="/psu_logo.png"
              width="30"
              height="30"
              className="d-inline-block align-top"
            />{'   '}
        <h1>   Park Visitation Dashboard Covid-19</h1>
      </Navbar>
    )
  }
  
  export default TitleBar