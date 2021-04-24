import React from "react"
import Navbar from 'react-bootstrap/Navbar';

function TitleBar() {
    return (
      <Navbar bg="primary" variant="dark" style={{marginRight: "1vw"}}>
        <Navbar.Brand>
          <img
                alt="PSU logo"
                src="/psu_logo.png"
                className="d-inline-block align-top"
                style={{width:"32px",
                  height:"32px",
                  marginRight:"10px"}}
              />
          <h1 style={{"display":"inline-block"}}>Park Visitation Dashboard Covid-19</h1>
        </Navbar.Brand>
        
      </Navbar>
    )
  }
  
  export default TitleBar