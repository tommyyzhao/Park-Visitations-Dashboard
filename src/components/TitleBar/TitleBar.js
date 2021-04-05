import React from "react"
import psu_logo from './psu_logo.png'
import './styles.scss';

function TitleBar() {
    return (
      <div className="titleContainer">
        <img className="psu_logo" src={psu_logo} alt="PSU logo"></img>
        <h1 className="title">Park Visitation Dashboard Covid-19</h1>
      </div>
    )
  }
  
  export default TitleBar