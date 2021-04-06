import React from "react"
import mapboxgl from "mapbox-gl"
//import { timeUnitDurations } from "@amcharts/amcharts4/.internal/core/utils/Time";
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
      zoom: map.getZoom().toFixed(2),
      safe_id: ""
    });

    map.on("move", () => {
      this.setState({
        zoom: map.getZoom().toFixed(2)})
      });

    map.on("load", () => {
      map.addSource('all_parks', {
        type: 'geojson',
        data: 'https://raw.githubusercontent.com/ztoms/Park-Visitations-Dashboard/main/src/data/labeled_visitor_change.geojson'
        });

      // add layer of parks with percent-change data
      map.addLayer({
        id: 'All',
        type: 'circle',
        source: 'all_parks',
        filter: ['!=', 'percent_change', ""],
        minzoom: 8,
        paint: {
          'circle-radius': [
              'interpolate',
              ['linear'],
              ['get', 'visitor_counts_pre2020'],
              1,
              3,
              10,
              6,
              100,
              12,
              1000,
              24,
              10000,
              32
            ],
          'circle-blur': 0.4,
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
        layout: {
          'visibility': 'none'
        },
      });


      map.addLayer({
        'id': 'All-labels',
        'type': 'symbol',
        'source': 'all_parks',
        'filter': ['!=', 'percent_change', ""],
        'minzoom': 8,
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
                  [10, 0],
                  [12, 12],
              ]
          },
          "visibility": "none",
        }
      });

      // add layer of parks with percent-change data
      map.addLayer({
        id: 'National',
        type: 'circle',
        source: 'all_parks',
        filter: ['all', ['!=', 'percent_change', ""], ['==', 'national', 1]],
        minzoom: 6,
        paint: {
          'circle-radius': [
              'interpolate',
              ['linear'],
              ['get', 'visitor_counts_pre2020'],
              1,
              3,
              10,
              6,
              100,
              12,
              1000,
              24,
              10000,
              32
            ],
          'circle-blur': 0.4,
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
        layout: {
          'visibility': 'none'
        }
      });


      map.addLayer({
        'id': 'National-labels',
        'type': 'symbol',
        'source': 'all_parks',
        'filter': ['all', ['!=', 'percent_change', ""], ['==', 'national', 1]],
        'minzoom': 4,
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
                  [10, 0],
                  [12, 12],
              ]
          },
          "visibility": "none"
        }
      });

      // add layer of parks with percent-change data
      map.addLayer({
        id: 'State',
        type: 'circle',
        source: 'all_parks',
        filter: ['all', ['!=', 'percent_change', ""], ['==', 'state', 1]],
        minzoom: 6,
        paint: {
          'circle-radius': [
              'interpolate',
              ['linear'],
              ['get', 'visitor_counts_pre2020'],
              1,
              3,
              10,
              6,
              100,
              12,
              1000,
              24,
              10000,
              32
            ],
          'circle-blur': 0.4,
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
        layout: {
          'visibility': 'none'
        }
      });


      map.addLayer({
        'id': 'State-labels',
        'type': 'symbol',
        'source': 'all_parks',
        'filter': ['all', ['!=', 'percent_change', ""], ['==', 'state', 1]],
        'minzoom': 4,
        'layout': {
          'text-field': ['get', 'location_name'],
          'text-variable-anchor': ['top', 'bottom', 'left', 'right'],
          'text-radial-offset': 0.8,
          'text-size': {
              'stops': [
                  [0, 0],
                  [3, 0],
                  [4, 0],
                  [5, 0],
                  [6, 0],
                  [7, 0],
                  [8, 0],
                  [10, 0],
                  [12, 12],
              ]
          },
          'visibility': 'none'
        }
      });
    });

    // Create toggleboxes to filter for different types of parks with a click event
    var id = "All";
    var id2 = "National"
    var id3 = "State"

    var link = document.createElement('a');
    link.href = '#';
    link.textContent = id;

    var link2 = document.createElement('a');
    link2.href = '#';
    link2.textContent = id2;

    var link3 = document.createElement('a');
    link3.href = '#';
    link3.textContent = id3;

    link.onclick = function(e) {
        e.preventDefault();
        e.stopPropagation();

        var layers = [];

        layers.push('All');
        layers.push('All-labels');

        for (var i = 0; i < layers.length; i++) {
            var visibility = map.getLayoutProperty(layers[i], 'visibility');
            if (visibility === 'visible') {
                map.setLayoutProperty(layers[i], 'visibility', 'none');
                link.className = '';
            } else {
                link.className = 'active';
                link2.className = '';
                link3.className = '';
                map.setLayoutProperty(layers[i], 'visibility', 'visible');
                map.setLayoutProperty('National', 'visibility', 'none');
                map.setLayoutProperty('National-labels', 'visibility', 'none');
                map.setLayoutProperty('State', 'visibility', 'none');
                map.setLayoutProperty('State-labels', 'visibility', 'none');
            }
        }

    }

    link2.onclick = function(e) {
        e.preventDefault();
        e.stopPropagation();

        var layers2 = [];

        layers2.push('National')
        layers2.push('National-labels');


        for (var j = 0; j < layers2.length; j++) {
            var visibility2 = map.getLayoutProperty(layers2[j], 'visibility');
            if (visibility2 === 'visible') {
                map.setLayoutProperty(layers2[j], 'visibility', 'none');
                link2.className = '';
            } else {
                link2.className = 'active';
                link.className = '';
                map.setLayoutProperty(layers2[j], 'visibility', 'visible');
                map.setLayoutProperty('All', 'visibility', 'none');
                map.setLayoutProperty('All-labels', 'visibility', 'none');
            }
        }
    }

    link3.onclick = function(e) {
        e.preventDefault();
        e.stopPropagation();

        var layers3 = [];

        layers3.push('State');
        layers3.push('State-labels');

        for (var k = 0; k < layers3.length; k++) {
            var visibility3 = map.getLayoutProperty(layers3[k], 'visibility');
            if (visibility3 === 'visible') {
                map.setLayoutProperty(layers3[k], 'visibility', 'none');
                link3.className = '';
            } else {
                link3.className = 'active';
                link.className = '';
                map.setLayoutProperty(layers3[k], 'visibility', 'visible');
                map.setLayoutProperty('All', 'visibility', 'none');
                map.setLayoutProperty('All-labels', 'visibility', 'none');
            }
        }
    }

    var layers = document.getElementById('menu');
    layers.appendChild(link);
    layers.appendChild(link2);
    layers.appendChild(link3);

    // Color legend
    var legend = document.getElementById('color-legend');
    legend.style.display = 'block'


    // The `click` event is an example of a `MapMouseEvent`.
    // Set up an event listener on the map.
    map.on('click', 'All', (e) => {
    // The event object (e) contains information like the
    // coordinates of the point on the map that was clicked.
      this.setState({
        selectedPark: e.features[0].properties
      });
      console.log('safegraph place id is', this.state.selectedPark);
    });

    map.on('click', 'National', (e) => {
      this.setState({
        selectedPark: e.features[0].properties
      });
      console.log('safegraph place id is', this.state.selectedPark);
    });

    map.on('click', 'State', (e) => {
      this.setState({
        selectedPark: e.features[0].properties
      });
      console.log('safegraph place id is', this.state.selectedPark);
    });

    // Create a popup, but don't add it to the map yet.
    var popup = new mapboxgl.Popup({
      closeButton: false,
      closeOnClick: false
    });

    // Create a mouse over event for the tooltip
    map.on('mouseenter', 'All', function (e) {
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

      pre2020 = pre2020 ? pre2020 : "no data"
      post2020 = post2020 ? post2020 : "no data"
      change = change ? change : "no data"

      // Populate the popup and set its coordinates based on the feature found.
      popup.setLngLat(coordinates).setHTML(`<b>${name}</b>, ${city}, ${state} <p> <b>Average Monthly Visitors</b> <br> Pre-2020: ${pre2020} <br>
                                            Post-2020: ${post2020} <br></p> <b>Percent change:</b> ${change}`).addTo(map);
    });

    map.on('mouseleave', 'All', function () {
      map.getCanvas().style.cursor = '';
      popup.remove();
    });

    map.on('mouseenter', 'National', function (e) {
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

      pre2020 = pre2020 ? pre2020 : "no data"
      post2020 = post2020 ? post2020 : "no data"
      change = change ? change : "no data"

      // Populate the popup and set its coordinates based on the feature found.
      popup.setLngLat(coordinates).setHTML(`<b>${name}</b>, ${city}, ${state} <p> <b>Average Monthly Visitors</b> <br> Pre-2020: ${pre2020} <br>
                                            Post-2020: ${post2020} <br></p> <b>Percent change:</b> ${change}`).addTo(map);
    });

    map.on('mouseleave', 'National', function () {
      map.getCanvas().style.cursor = '';
      popup.remove();
    });

    map.on('mouseenter', 'State', function (e) {
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

      pre2020 = pre2020 ? pre2020 : "no data"
      post2020 = post2020 ? post2020 : "no data"
      change = change ? change : "no data"

      // Populate the popup and set its coordinates based on the feature found.
      popup.setLngLat(coordinates).setHTML(`<b>${name}</b>, ${city}, ${state} <p> <b>Average Monthly Visitors</b> <br> Pre-2020: ${pre2020} <br>
                                            Post-2020: ${post2020} <br></p> <b>Percent change:</b> ${change}`).addTo(map);
    });

    map.on('mouseleave', 'State', function () {
      map.getCanvas().style.cursor = '';
      popup.remove();
    });

    this.map = map;

  }

  componentDidUpdate(prevProps) {
    const data  = this.props
    const mapIsLoaded  = this.state

    if (!mapIsLoaded) {
      console.log("map is not loaded")
      return
    }

    if (data === prevProps) {
      return //do nothing if props didn't change
    } else {
      console.log("changed data")
      console.log(data)
      console.log(prevProps)
      this.setState({lat: data.parkLat, lng: data.parkLng})
      this.map.flyTo({
        center: [data.parkLng, data.parkLat],
        zoom: 18
      })
    }
  }


  // Generate the map component for the dashboard
  render() {
    const { lng, lat, zoom } = this.state;
    return (
      <div>
        <div className="sidebar">
            Longitude: {lng} | Latitude: {lat} | Zoom: {zoom}
        </div>
        <nav id="menu"></nav>
        <div
          ref={this.mapContainer}
          className="map-container"
          style={{
            height: "100vh"
          }}>
        </div>
        <div id="color-legend" class="legend" >
          <div><h4>Park Visitation Percent Change Post COVID-19</h4></div>
          <div><span style={{'background-color': 'rgba(19,225,19,0.8)'}}></span>100%</div>
          <div><span style={{'background-color': 'rgba(225,225,19,0.5)'}}></span>0%</div>
          <div><span style={{'background-color': 'rgba(225,19,19,0.8)'}}></span>-100%</div>
          <div>* Size represents average monthly visitations post COVID-19</div>
        </div>
      </div>

    );
  }
}


export default (MapComponent)
