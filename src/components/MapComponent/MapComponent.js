import React from "react"
import mapboxgl from "mapbox-gl"
//import { MapboxLayer } from '@deck.gl/mapbox'
//import {ScatterplotLayer} from '@deck.gl/layers';


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
    var map = new mapboxgl.Map({
      container: this.mapContainer.current,
      style: "mapbox://styles/mapbox/outdoors-v11",
      center: [this.state.lng, this.state.lat],
      zoom: this.state.zoom
    });


    this.setState({
      lng: map.getCenter().lng.toFixed(4),
      lat: map.getCenter().lat.toFixed(4),
      zoom: map.getZoom().toFixed(2)
    });

    map.on("move", () => {
      this.setState({
        lng: map.getCenter().lng.toFixed(4),
        lat: map.getCenter().lat.toFixed(4),
        zoom: map.getZoom().toFixed(2)})
      });

    map.on("load", () => {
      map.addSource('all_parks', {
        type: 'geojson',
        data: 'https://raw.githubusercontent.com/ztoms/Park-Visitations-Dashboard/main/src/data/visitor_counts.geojson'
        });


      map.addLayer({
        id: 'poi-locations',
        type: 'circle',
        source: 'all_parks',
        minzoom: 7,
        paint: {
          'circle-radius': [
              'interpolate',
              ['linear'],
              ['get', 'visitor_counts_post2020'],
              1,
              2,
              10,
              4,
              100,
              8,
              1000,
              16,
              10000,
              32
            ],
          'circle-blur': 0.5,
          'circle-color': [
            'interpolate',
            ['linear'],
            ['get', 'percent_change'],
            -1,
            'rgba(225,19,19,0.8)',
            0,
            'rgba(225,225,19,0.5)',
            1,
            'rgba(19,225,19,0.8)'
            ]
        },
      });

      map.addLayer({
        'id': 'poi-labels',
        'type': 'symbol',
        'source': 'all_parks',
        'minzoom': 5,
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
                  [10, 6],
                  [12, 12],
              ]
          }
        }
      });

    });

    // Create a popup, but don't add it to the map yet.
    var popup = new mapboxgl.Popup({
      closeButton: false,
      closeOnClick: false
    });

    map.on('mouseenter', 'poi-locations', function (e) {
      map.getCanvas().style.cursor = 'pointer';

      var coordinates = e.features[0].geometry.coordinates.slice();
      var name = e.features[0].properties.location_name;
      var city = e.features[0].properties.city;
      var state = e.features[0].properties.region;
      var pre2020 = e.features[0].properties.visitor_counts_pre2020;
      var post2020 = e.features[0].properties.visitor_counts_post2020;
      var change = e.features[0].properties.percent_change;

      // Ensure that if the map is zoomed out such that multiple copies of the feature are visible, the popup appears over the copy being pointed to.
      while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
        coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
      }

      // Populate the popup and set its coordinates based on the feature found.
      popup.setLngLat(coordinates).setHTML(`<p> Park Name: ${name} <br></p> <p> City: ${city} <br></p> <p> State: ${state} <br></p> <p> Average Visitor Counts Pre2020: ${pre2020} <br></p>
                                            <p> Average Visitor Counts Post2020: ${post2020} <br></p> <p> Percent Change: ${change} </p>`).addTo(map);
    });

    map.on('mouseleave', 'poi-locations', function () {
      map.getCanvas().style.cursor = '';
      popup.remove();
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
