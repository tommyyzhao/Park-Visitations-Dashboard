import React from "react"
import mapboxgl from "mapbox-gl"
import { MapboxLayer } from '@deck.gl/mapbox'
import {ScatterplotLayer} from '@deck.gl/layers';


mapboxgl.accessToken =
'pk.eyJ1Ijoic2NvdHRwZXoiLCJhIjoiY2tjNHYzMWlmMDk0dzJ0cXBlYmY3ZGFkMSJ9.3sV7qx5UKfvCQPFXXTGFBw';


class MapComponent extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      lng: -97,
      lat: 38,
      zoom: 4
    };
    this.mapContainer = React.createRef();
    // mapbox layer

  }

  componentDidMount() {
    this.map = new mapboxgl.Map({
      container: this.mapContainer.current,
      style: "mapbox://styles/mapbox/light-v9",
      center: [this.state.lng, this.state.lat],
      zoom: this.state.zoom
    });


    this.setState({
      lng: this.map.getCenter().lng.toFixed(4),
      lat: this.map.getCenter().lat.toFixed(4),
      zoom: this.map.getZoom().toFixed(2)
    });

    this.map.on("move", () => {
      this.setState({
        lng: this.map.getCenter().lng.toFixed(4),
        lat: this.map.getCenter().lat.toFixed(4),
        zoom: this.map.getZoom().toFixed(2)})
      });

    this.map.on("load", () => {


      const visitationChangeLayer = new MapboxLayer({
        id: 'my-scatterplot',
        type: ScatterplotLayer,
        data: 'https://raw.githubusercontent.com/ztoms/Park-Visitations-Dashboard/main/src/data/change_in_visitor_counts.json',
        getPosition: d => [d.longitude, d.latitude],
        getRadius: 500,/*d => {
          if (d.percent_change) {
            return Math.round(Math.sqrt(Math.abs(d.percent_change) * 100000))+500
          } else {
            return 500
          }
        }, */
        getColor: d => {
              //if (d.percent_change) {
                if (d.percent_change > 1) {
                  return [10, 41, 10, 180]
                }
                else if (d.percent_change > 0.5) {
                  return [25, 103, 25, 180]
                }
                else if (d.percent_change > 0.3) {
                  return [45, 185, 45, 180]
                }
                else if (d.percent_change > 0) {
                  return [193, 240, 193, 180]
                }
                else if (d.percent_change > -0.3) {
                  return [255, 179, 179, 180]
                }
                else if (d.percent_change > -0.5) {
                  return [255, 77, 77, 180]
                }
                else if (d.percent_change > -1) {
                  return [230, 0, 0, 180]
                }
                else {
                  return [128, 0, 0, 180]
                }
              }

            //else {
            //    return [192, 192, 192, 0] // return gray if no data 80
            //}
        //}
      });

      this.map.addLayer(visitationChangeLayer)

      this.map.addSource('national', {
        type: 'geojson',
        data: 'https://raw.githubusercontent.com/ztoms/Park-Visitations-Dashboard/main/src/data/visitor_counts_change.geojson'
        });

      /*
      this.map.addLayer({
        id: 'national_parks',
        type: 'circle',
        source: 'national',
        //layout: {
        //  visibility: 'none',
        //},
        paint: {
          'circle-radius': ['get', 'percent_change'],
          'circle-color': '#40BF45',
          'circle-opacity': 0.7
        },
      });*/

      this.map.addLayer({
        'id': 'poi-labels',
        'type': 'symbol',
        'source': 'national',
        'layout': {
        'text-field': ['get', 'location_name'],
        'text-variable-anchor': ['top', 'bottom', 'left', 'right'],
        'text-radial-offset': 0.8,
        "text-size": {
            "stops": [
                [0, 0],
                [3, 0],
                [4, 0],
                [5, 0],
                [6, 0],
                [7, 0],
                [8, 0],
                [10, 4],
                [12, 8],
            ]
        }
      }
      });

    });
  }





  render() {
    const { lng, lat, zoom } = this.state;
    return (
      <div>
        <div className="sidebar">
            Longitude: {lng} | Latitude: {lat} | Zoom: {zoom}
        </div>
        <div
          ref={this.mapContainer}
          className="map-container"
          style={{
            height: "100vh"
          }}>
        </div>
      </div>

    );
  }
}


export default (MapComponent)
