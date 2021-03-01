import React from "react"
import mapboxgl from "mapbox-gl"

mapboxgl.accessToken =
'pk.eyJ1Ijoic2NvdHRwZXoiLCJhIjoiY2tjNHYzMWlmMDk0dzJ0cXBlYmY3ZGFkMSJ9.3sV7qx5UKfvCQPFXXTGFBw';

class MapComponent extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      lng: -77.86,
      lat: 40.8,
      zoom: 7
    };
  }

  componentDidMount() {
    const map = new mapboxgl.Map({
      container: "map",
      style: "mapbox://styles/mapbox/light-v9",
      center: [this.state.lng, this.state.lat],
      zoom: this.state.zoom
    });

    map.on("move", () => {
      this.setState({
        lng: map.getCenter().lng.toFixed(4),
        lat: map.getCenter().lat.toFixed(4),
        zoom: map.getZoom().toFixed(2)
      });
    });
  }

  render() {
    return (
      <div
        id="map"
        style={{
          position: "relative",
          height: "100vh"
        }}
      />
    );
  }
}


export default (MapComponent)
