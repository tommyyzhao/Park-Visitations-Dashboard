import React from "react"
import mapboxgl from "mapbox-gl"
//import { timeUnitDurations } from "@amcharts/amcharts4/.internal/core/utils/Time";
import { MapboxLayer } from '@deck.gl/mapbox'
import {ArcLayer} from '@deck.gl/layers'

// eslint-disable-next-line import/no-webpack-loader-syntax
mapboxgl.workerClass = require('worker-loader!mapbox-gl/dist/mapbox-gl-csp-worker').default;

mapboxgl.accessToken =
'pk.eyJ1IjoienRvbXMiLCJhIjoiY2tucTQ5ajhiMGE1dDJxcXZueTg4eTVrNiJ9.ChK9cBOSuoX-v1thHfM43A';

// Adapted from https://reactjs.org/docs/react-component.html
class MapComponent extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      zoom: 4
    };
    this.mapContainer = React.createRef();

    this.negative_color = 'rgba(197,27,125,0.8)'
    this.neutral_color = 'rgba(247,247,247, 0.885)'
    this.positive_color = 'rgba(77,146,33,0.8)'

    this.testData = {
      "60376025041":7,
      "60376025041_longitude":-118.3373236,
      "60376025041_latitude":33.9073685,
      "60374620011":5,
      "60374620011_longitude":-118.1439295,
      "60374620011_latitude":34.1654279,
      "60374625003":4.33333333333333,
      "60374625003_longitude":-118.1057541,
      "60374625003_latitude":34.1666722,
      "60374305011":4.42857142857143,
      "60374305011_longitude":-118.0569317,
      "60374305011_latitude":34.1748251,
      "60374013122":4.25,
      "60374013122_longitude":-117.8294514,
      "60374013122_latitude":34.095830600000006,
      "60710015011":8,
      "60710015011_longitude":-117.6392854,
      "60710015011_latitude":34.067719700000005}
      this.arcData = []
      // Initializing arcLayer from deck.gl (https://deck.gl/docs/api-reference/layers/arc-layer)
      this.arcLayer = new MapboxLayer({
        id: 'deckgl-arc',
        type: ArcLayer,
        data: [],
        getSourcePosition: d => d.source,
        getTargetPosition: d => d.target,
        getSourceColor: [255, 123, 82],
        getTargetColor: [255, 61, 0],
        getWidth: d => Math.sqrt(d.visits),
        pickable: true,
        onHover: info => this.setState({arcHoverInfo: info}),
        visible: false
      })
      this.arcLayerPreCovid = new MapboxLayer({
        id: 'deckgl-arc-precovid',
        type: ArcLayer,
        data: [],
        getSourcePosition: d => d.source,
        getTargetPosition: d => d.target,
        getSourceColor: [159, 133, 201],
        getTargetColor: [132, 94, 194],
        getWidth: d => Math.sqrt(d.visits),
        pickable: true,
        onHover: info => this.setState({arcHoverInfo: info}),
        visible: false
      })
  }

  componentDidMount() {
    var map = new mapboxgl.Map({
      container: this.mapContainer.current,
      style: "mapbox://styles/ztoms/cknur1zjf136m17per0xi3rz7",
      center: [this.props.parkLng, this.props.parkLat],
      zoom: this.state.zoom
    });


    this.setState({
      lng: map.getCenter().lng.toFixed(4),
      lat: map.getCenter().lat.toFixed(4),
      zoom: map.getZoom().toFixed(2)
    });

    map.on("move", () => {
      this.setState({
        zoom: map.getZoom().toFixed(2)})
      });

    // Adapted from https://docs.mapbox.com/mapbox-gl-js/api/map/
    map.on("load", () => {

      map.addSource('all_parks', {
        type: 'geojson',
        data: 'https://raw.githubusercontent.com/ztoms/Park-Visitations-Dashboard/main/dashboard/src/data/labeled_change.geojson'
      });

      map.addSource('county_parks', {
        type: 'geojson',
        data: 'https://raw.githubusercontent.com/ztoms/Park-Visitations-Dashboard/main/dashboard/src/data/county_change.geojson'
      });

      map.loadImage('https://image.flaticon.com/icons/png/128/3448/3448536.png',
        function(error, image) {
        if (error) throw error;
        map.addImage('county', image, {width: 50, height: 50} ); // 38x55px, shadow adds 5px (for scale eq 1)
      });


      map.addLayer(this.arcLayer)
      map.addLayer(this.arcLayerPreCovid)

      // Adapted from https://docs.mapbox.com/mapbox-gl-js/api/map/
      // add layer of parks with percent-change data
      map.addLayer({
        id: 'All',
        type: 'circle',
        source: 'all_parks',
        filter: ['!=', 'percent_change', ""],
        minzoom: 7,
        paint: {
          'circle-radius': [
              'interpolate',
              ['linear'],
              ['get', 'visitor_counts_postcovid'],
              1,3,
              10,6,
              100,12,
              1000,24,
              10000,32
            ],
          'circle-blur': 0.2,
          'circle-stroke-width': 0.1,
          'circle-stroke-color': '#000000',
          'circle-color': [
            'interpolate',
            ['linear'],
            ['get', 'percent_change'],
            -1,this.negative_color,
            0,this.neutral_color,
            1,this.positive_color
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
        'minzoom': 11,
        'layout': {
          'text-field': ['get', 'location'],
          'text-variable-anchor': ['top', 'bottom', 'left', 'right'],
          'text-radial-offset': 0.8,
          'text-font': ["Roboto Regular"],
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
        minzoom: 4,
        paint: {
          'circle-radius': [
              'interpolate',
              ['linear'],
              ['get', 'visitor_counts_postcovid'],
              1,3,
              10,6,
              100,12,
              1000,24,
              10000,32
            ],
          'circle-blur': 0.2,
          'circle-stroke-width': 0.1,
          'circle-stroke-color': '#000000',
          'circle-color': [
            'interpolate',
            ['linear'],
            ['get', 'percent_change'],
            -1,this.negative_color,
            0,this.neutral_color,
            1,this.positive_color
            ]
        },
        layout: {
          'visibility': 'visible'
        }
      });


      map.addLayer({
        'id': 'National-labels',
        'type': 'symbol',
        'source': 'all_parks',
        'filter': ['all', ['!=', 'percent_change', ""], ['==', 'national', 1]],
        'minzoom': 4,
        'layout': {
          'text-field': ['get', 'location'],
          'text-variable-anchor': ['top', 'bottom', 'left', 'right'],
          'text-radial-offset': 0.8,
          'text-font': ["Roboto Regular"],
          'text-size': {
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
          "visibility": "visible"
        }
      });

      // add layer of parks with percent-change data
      map.addLayer({
        id: 'State',
        type: 'circle',
        source: 'all_parks',
        filter: ['all', ['!=', 'percent_change', ""], ['==', 'state', 1]],
        minzoom: 4,
        paint: {
          'circle-radius': [
              'interpolate',
              ['linear'],
              ['get', 'visitor_counts_postcovid'],
              1,3,
              10,6,
              100,12,
              1000,24,
              10000,32
            ],
          'circle-blur': 0.2,
          'circle-stroke-width': 0.1,
          'circle-stroke-color': '#000000',
          'circle-color': [
            'interpolate',
            ['linear'],
            ['get', 'percent_change'],
            -1,this.negative_color,
            0,this.neutral_color,
            1,this.positive_color
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
          'text-field': ['get', 'location'],
          'text-variable-anchor': ['top', 'bottom', 'left', 'right'],
          'text-radial-offset': 0.8,
          'text-font': ["Roboto Regular"],
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

      // add county layer with percent-change data
      map.addLayer({
        id: 'County',
        type: 'circle',
        source: 'county_parks',
        minzoom: 4,
        paint: {
          'circle-radius': [
              'interpolate',
              ['linear'],
              ['get', 'visitor_counts_postcovid'],
              1,3,
              10,6,
              100,12,
              1000,24,
              10000,32
            ],
          'circle-blur': 0.2,
          'circle-stroke-width': 1,
          'circle-stroke-color': '#Af5d04',
          'circle-color': [
            'interpolate',
            ['linear'],
            ['get', 'percent_change'],
            -1,this.negative_color,
            0,this.neutral_color,
            1,this.positive_color
            ]
        },
        layout: {
          'visibility': 'none'
        }
      });

      map.addLayer({
        'id': 'icon',
        'type': 'symbol',
        'source': 'county_parks', // reference the data source
        'minzoom': 4,
        'layout': {
          'icon-image': 'county', // reference the image
          'icon-size': 0.2,
          'icon-anchor': 'bottom',
          'icon-offset': [0, 5],
          'icon-allow-overlap': true,
          'visibility': 'none'
        }
      });


      map.addLayer({
        'id': 'County-labels',
        'type': 'symbol',
        'source': 'county_parks',
        'minzoom': 4,
        'layout': {
          'text-field': ['get', 'county'],
          'text-variable-anchor': ['top', 'bottom', 'left', 'right'],
          'text-radial-offset': 0.8,
          'text-font': ["Roboto Regular"],
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
    var id4 = "County"

    var link = document.createElement('a');
    link.href = '#';
    link.textContent = id;

    var link2 = document.createElement('a');
    link2.href = '#';
    link2.textContent = id2;

    var link3 = document.createElement('a');
    link3.href = '#';
    link3.textContent = id3;

    var link4 = document.createElement('a');
    link4.href = '#';
    link4.textContent = id4;

    link2.className = 'active';

    link.onclick = function(e) {
        e.preventDefault();
        e.stopPropagation();

        var layers1 = [];

        layers1.push('All');
        layers1.push('All-labels');

        for (var i = 0; i < layers1.length; i++) {
            var visibility = map.getLayoutProperty(layers1[i], 'visibility');
            if (visibility === 'visible') {
                map.setLayoutProperty(layers1[i], 'visibility', 'none');
                link.className = '';
            } else {
                link.className = 'active';
                link2.className = '';
                link3.className = '';
                link4.className = '';
                map.setLayoutProperty(layers1[i], 'visibility', 'visible');
                map.setLayoutProperty('National', 'visibility', 'none');
                map.setLayoutProperty('National-labels', 'visibility', 'none');
                map.setLayoutProperty('State', 'visibility', 'none');
                map.setLayoutProperty('State-labels', 'visibility', 'none');
                map.setLayoutProperty('County', 'visibility', 'none');
                map.setLayoutProperty('icon', 'visibility', 'none');
                map.setLayoutProperty('County-labels', 'visibility', 'none');
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
                link4.className = '';
                map.setLayoutProperty(layers2[j], 'visibility', 'visible');
                map.setLayoutProperty('All', 'visibility', 'none');
                map.setLayoutProperty('All-labels', 'visibility', 'none');
                map.setLayoutProperty('County', 'visibility', 'none');
                map.setLayoutProperty('icon', 'visibility', 'none');
                map.setLayoutProperty('County-labels', 'visibility', 'none');
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
                link4.className = '';
                map.setLayoutProperty(layers3[k], 'visibility', 'visible');
                map.setLayoutProperty('All', 'visibility', 'none');
                map.setLayoutProperty('All-labels', 'visibility', 'none');
                map.setLayoutProperty('County', 'visibility', 'none');
                map.setLayoutProperty('icon', 'visibility', 'none');
                map.setLayoutProperty('County-labels', 'visibility', 'none');
            }
        }
    }

    link4.onclick = function(e) {
        e.preventDefault();
        e.stopPropagation();

        var layers4 = [];

        layers4.push('icon');
        layers4.push('County');
        layers4.push('County-labels');

        for (var l = 0; l < layers4.length; l++) {
            var visibility4 = map.getLayoutProperty(layers4[l], 'visibility');
            if (visibility4 === 'visible') {
                map.setLayoutProperty(layers4[l], 'visibility', 'none');
                link4.className = '';
            } else {
                link4.className = 'active';
                link.className = '';
                link2.className = '';
                link3.className = '';
                map.setLayoutProperty(layers4[l], 'visibility', 'visible');
                map.setLayoutProperty('All', 'visibility', 'none');
                map.setLayoutProperty('All-labels', 'visibility', 'none');
                map.setLayoutProperty('National', 'visibility', 'none');
                map.setLayoutProperty('National-labels', 'visibility', 'none');
                map.setLayoutProperty('State', 'visibility', 'none');
                map.setLayoutProperty('State-labels', 'visibility', 'none');
            }
        }
    }

    var layers = document.getElementById('menu');
    layers.appendChild(link);
    layers.appendChild(link2);
    layers.appendChild(link3);
    layers.appendChild(link4);

    // Color legend
    var legend = document.getElementById('color-legend');
    legend.style.display = 'block'

    // Adapted from https://docs.mapbox.com/mapbox-gl-js/api/map/
    // Set up an event listener on the map.
    map.on('click', 'All', (e) => {
      this.props.setSearch({ selectedParkId: e.features[0].properties.safegraph_place_id })
    });

    map.on('click', 'National', (e) => {
      this.props.setSearch({ selectedParkId: e.features[0].properties.safegraph_place_id })
    });

    map.on('click', 'State', (e) => {
      this.props.setSearch({ selectedParkId: e.features[0].properties.safegraph_place_id })
    });

    // Adapted from https://docs.mapbox.com/mapbox-gl-js/api/map/
    // Create a popup, but don't add it to the map yet.
    var popup = new mapboxgl.Popup({
      closeButton: false,
      closeOnClick: false
    });

    // Adapted from https://docs.mapbox.com/mapbox-gl-js/api/map/
    // Create a mouse over event for the tooltip
    map.on('mouseenter', 'All', function (e) {
      map.getCanvas().style.cursor = 'pointer';

      var coordinates = e.features[0].geometry.coordinates.slice();
      var name = e.features[0].properties.location;
      var city = e.features[0].properties.city;
      var state = e.features[0].properties.region;
      var precovid = e.features[0].properties.visitor_counts_precovid;
      var postcovid = e.features[0].properties.visitor_counts_postcovid;
      var change = e.features[0].properties.percent_change;

      // Ensure that if the map is zoomed out such that multiple copies of the feature are visible, the popup appears over the copy being pointed to.
      while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
        coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
      }

      precovid = precovid ? precovid : "no data"
      postcovid = postcovid ? postcovid : "no data"
      change = change ? change : "no data"

      // Populate the popup and set its coordinates based on the feature found.
      popup.setLngLat(coordinates).setHTML(`<b>${name}</b>, ${city}, ${state} <p> <b>Average Monthly Visitors</b> <br> Pre-COVID: ${precovid} <br>
                                            Post-COVID: ${postcovid} <br></p> <b>Percent change:</b> ${change}`).addTo(map);
    });

    map.on('mouseleave', 'All', function () {
      map.getCanvas().style.cursor = '';
      popup.remove();
    });

    map.on('mouseenter', 'National', function (e) {
      map.getCanvas().style.cursor = 'pointer';

      var coordinates = e.features[0].geometry.coordinates.slice();
      var name = e.features[0].properties.location;
      var city = e.features[0].properties.city;
      var state = e.features[0].properties.region;
      var precovid  = e.features[0].properties.visitor_counts_precovid;
      var postcovid  = e.features[0].properties.visitor_counts_postcovid;
      var change = e.features[0].properties.percent_change;

      // Ensure that if the map is zoomed out such that multiple copies of the feature are visible, the popup appears over the copy being pointed to.
      while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
        coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
      }

      precovid = precovid ? precovid : "no data"
      postcovid = postcovid ? postcovid : "no data"
      change = change ? change : "no data"

      // Populate the popup and set its coordinates based on the feature found.
      popup.setLngLat(coordinates).setHTML(`<b>${name}</b>, ${city}, ${state} <p> <b>Average Monthly Visitors</b> <br> Pre-COVID: ${precovid} <br>
                                            Post-COVID: ${postcovid} <br></p> <b>Percent change:</b> ${change}`).addTo(map);
    });

    map.on('mouseleave', 'National', function () {
      map.getCanvas().style.cursor = '';
      popup.remove();
    });

    map.on('mouseenter', 'State', function (e) {
      map.getCanvas().style.cursor = 'pointer';

      var coordinates = e.features[0].geometry.coordinates.slice();
      var name = e.features[0].properties.location;
      var city = e.features[0].properties.city;
      var state = e.features[0].properties.region;
      var precovid = e.features[0].properties.visitor_counts_precovid;
      var postcovid = e.features[0].properties.visitor_counts_postcovid;
      var change = e.features[0].properties.percent_change;

      // Ensure that if the map is zoomed out such that multiple copies of the feature are visible, the popup appears over the copy being pointed to.
      while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
        coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
      }

      precovid = precovid ? precovid : "no data"
      postcovid = postcovid ? postcovid : "no data"
      change = change ? change : "no data"

      // Populate the popup and set its coordinates based on the feature found.
      popup.setLngLat(coordinates).setHTML(`<b>${name}</b>, ${city}, ${state} <p> <b>Average Monthly Visitors</b> <br> Pre-COVID: ${precovid} <br>
                                            Post-COVID: ${postcovid} <br></p> <b>Percent change:</b> ${change}`).addTo(map);
    });

    map.on('mouseleave', 'State', function () {
      map.getCanvas().style.cursor = '';
      popup.remove();
    });

    map.on('mouseenter', 'County', function (e) {
      map.getCanvas().style.cursor = 'pointer';

      var coordinates = e.features[0].geometry.coordinates.slice();
      var name = e.features[0].properties.county;
      var fips = e.features[0].properties.county_fips;
      var state = e.features[0].properties.state;
      var precovid = e.features[0].properties.visitor_counts_precovid;
      var postcovid = e.features[0].properties.visitor_counts_postcovid;
      var change = e.features[0].properties.percent_change;

      // Ensure that if the map is zoomed out such that multiple copies of the feature are visible, the popup appears over the copy being pointed to.
      while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
        coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
      }

      precovid = precovid ? precovid : "no data"
      postcovid = postcovid ? postcovid : "no data"
      change = change ? change : "no data"

      // Populate the popup and set its coordinates based on the feature found.
      popup.setLngLat(coordinates).setHTML(`<b>${name}</b>, ${state}, ${fips} <p> <b>Average Monthly Visitors</b> <br> Pre-COVID: ${precovid} <br>
                                            Post-COVID: ${postcovid} <br></p> <b>Percent change:</b> ${change}`).addTo(map);
    });

    map.on('mouseleave', 'County', function () {
      map.getCanvas().style.cursor = '';
      popup.remove();
    });

    this.map = map;

  }

  componentDidUpdate(prevProps) {
    const data  = this.props

    // fly to parkLng and parkLat if changed
    if (data.parkLng && data.parkLng === prevProps.parkLng) {
       //console.log("selected coordinates unchanged") //do nothing if props didn't change
    } else {
      this.map.flyTo({
        center: [data.parkLng, data.parkLat],
        zoom: 14
      })
    }

    // update arc layer visibility if button is changed
    if (data.showArcsMode !== prevProps.showArcsMode) {
      if(data.showArcsMode === "off") {
        this.arcLayer.setProps({visible: false})
        this.arcLayerPreCovid.setProps({visible: false})
      } else if (data.showArcsMode === "postcovid") {
        this.arcLayer.setProps({visible: true})
        this.arcLayerPreCovid.setProps({visible: false})
      }else if (data.showArcsMode === "precovid") {
        this.arcLayer.setProps({visible: false})
        this.arcLayerPreCovid.setProps({visible: true})
      } else if (data.showArcsMode === "both") {
        this.arcLayer.setProps({visible: true})
        this.arcLayerPreCovid.setProps({visible: true})
      }
    }

    // updated arc layer if origin Data is updated
    if (!data.originCovidData || !data.originCovidData.safegraph_place_id) {
      //console.log("no originCovidData")
    } else if (prevProps.originCovidData && prevProps.originCovidData.safegraph_place_id && data.originCovidData.safegraph_place_id === prevProps.originCovidData.safegraph_place_id) {
      //console.log("originCovid data unchanged")
    } else {
      let arcData = []
      let tempKeys = {} //temp var to parse data by keys

      // due to our data schema we must first group by census block
      for (const [key, value] of Object.entries(data.originCovidData)) {
        // skip invalid keys
        if (key === "_id" || key === "safegraph_place_id") {
          continue
        }
        //if key not lat or lng
        if (key.endsWith("longitude")) {
          let census_block_id = key.slice(0,-10)
          // if not yet defined, set to empty object
          tempKeys[census_block_id] = tempKeys[census_block_id] || {}
          tempKeys[census_block_id]['lng'] = value
        } else if (key.endsWith("latitude")) {
          let census_block_id = key.slice(0,-9)
          tempKeys[census_block_id] = tempKeys[census_block_id] || {}
          tempKeys[census_block_id]['lat'] = value
        } else {
          tempKeys[key] = tempKeys[key] || {}
          tempKeys[key]['mean_visits'] = value
        }
      }
      // prepare data to be plotted
      for(const [key, value] of Object.entries(tempKeys)) {
        arcData.push({
          source: [value['lng'], value['lat']],
          target: [data.parkLng, data.parkLat],
          visits: value['mean_visits'],
          cb_id: key
        });
      }
      console.log('updating arcLayer props')
      console.log(arcData)
      this.arcLayer.setProps({data: arcData})
    }

    // PRE COVID updated arc layer if origin Data is updated
    if (!data.originPreCovidData || !data.originPreCovidData.safegraph_place_id) {
      //console.log("no originPreCovidData")
    } else if (prevProps.originPreCovidData && prevProps.originPreCovidData.safegraph_place_id && data.originPreCovidData.safegraph_place_id === prevProps.originPreCovidData.safegraph_place_id) {
      //console.log("originPreCovid data unchanged")
    } else {
      let arcData = []
      let tempKeys = {} //temp var to parse data by keys

      // due to our data schema we must first group by census block
      for (const [key, value] of Object.entries(data.originPreCovidData)) {
        // skip invalid keys
        if (key === "_id" || key === "safegraph_place_id") {
          continue
        }
        //if key not lat or lng
        if (key.endsWith("longitude")) {
          let census_block_id = key.slice(0,-10)
          // if not yet defined, set to empty object
          tempKeys[census_block_id] = tempKeys[census_block_id] || {}
          tempKeys[census_block_id]['lng'] = value
        } else if (key.endsWith("latitude")) {
          let census_block_id = key.slice(0,-9)
          tempKeys[census_block_id] = tempKeys[census_block_id] || {}
          tempKeys[census_block_id]['lat'] = value
        } else {
          tempKeys[key] = tempKeys[key] || {}
          tempKeys[key]['mean_visits'] = value
        }
      }
      // prepare data to be plotted
      for(const [key, value] of Object.entries(tempKeys)) {
        arcData.push({
          source: [value['lng'], value['lat']],
          target: [data.parkLng, data.parkLat],
          visits: value['mean_visits'],
          cb_id: key
        });
      }
      //console.log('updating arcLayerPreCovid props')
      //console.log(arcData)
      this.arcLayerPreCovid.setProps({data: arcData})
    }

  }


  // Generate the map component for the dashboard
  render() {
    const { zoom } = this.state;
    //console.log(this.state.arcHoverInfo)
    return (
      <div>
        <div className="sidebar">
            Longitude: {this.props.parkLng} | Latitude: {this.props.parkLat} | Zoom: {zoom}
        </div>
        {this.state.arcHoverInfo && this.state.arcHoverInfo.object && <div style={{
          backgroundColor: '#ffffff', padding: "5px",
          position: 'absolute',
          zIndex: 1,
          pointerEvents: 'none',
          left: this.state.arcHoverInfo.x,
          top: this.state.arcHoverInfo.y+10}}>
            <h4>{this.state.arcHoverInfo.object.visits}</h4> mean monthly visitations, post-Covid (from census-block with ID: {this.state.arcHoverInfo.object.cb_id})
        </div>}
        <nav id="menu"><h3 style={{borderStyle: 'solid', borderWidth: '1px', textAlign: 'center', padding:'5px'}}>Filter by type</h3></nav>
        <div
          ref={this.mapContainer}
          className="map-container"
          style={{
            height: "90vh",
            top: '10px',
            right: '0px'
          }}>
        </div>
        <div id="color-legend" className="legend" >
          <div><h4>Percent Change in Average Monthly Park Visitations Pre vs. Post COVID-19</h4></div>
          <div className="colorbar"></div>
          <ul>
            <li className="left">-100%</li>
            <li>0%</li>
            <li className="right">100%</li>
          </ul>
          <div>* Circle size represents volume of average monthly visitations post COVID-19</div>
        </div>
      </div>

    );
  }
}


export default (MapComponent)
