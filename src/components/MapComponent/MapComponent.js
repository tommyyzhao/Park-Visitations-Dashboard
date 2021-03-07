import React from "react"
import mapboxgl from "mapbox-gl"
import './styles.scss';


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

      this.map.addSource('national', {
        type: 'geojson',
        data: {
           type: "FeatureCollection",
           features: [
          {
            type: "Feature",
            geometry: {
               type: "Point",
               coordinates:  [ -124.137765,43.984847 ]
            },
            properties: {
            safegraph_place_id:"sg:58bfb9ed5fb646fdad91d44be690db40",
            location_name:"Sand Dunes National Park"
            }
          },
          {
            type: "Feature",
            geometry: {
               type: "Point",
               coordinates:  [ -155.256958,19.429665 ]
            },
            properties: {
            safegraph_place_id:"sg:2bb1c1290b6b494e82be0098b30ad724",
            location_name:"Hawai'i Volcanoes National Park"
            }
          },
          {
            type: "Feature",
            geometry: {
               type: "Point",
               coordinates:  [ -90.796964,44.959408 ]
            },
            properties: {
            safegraph_place_id:"sg:48f09f62ad5e4aada7cc7ef380b6a18a",
            location_name:"Yellowstone Park"
            }
          },
          {
            type: "Feature",
            geometry: {
               type: "Point",
               coordinates:  [ -121.22864,37.788676 ]
            },
            properties: {
            safegraph_place_id:"sg:722629f32b574f78abf6b8065bef5314",
            location_name:"Sequoia Park"
            }
          },
          {
            type: "Feature",
            geometry: {
               type: "Point",
               coordinates:  [ -83.596999,35.964355 ]
            },
            properties: {
            safegraph_place_id:"sg:f74aced14847493eb71d543207d86192",
            location_name:"Friends of Great Smoky Mountains National Park"
            }
          },
          {
            type: "Feature",
            geometry: {
               type: "Point",
               coordinates:  [ -104.821761,31.894305 ]
            },
            properties: {
            safegraph_place_id:"sg:acbeed2c270445179089c2a6c71d4c3e",
            location_name:"Guadalupe Mountains National Park"
            }
          },
          {
            type: "Feature",
            geometry: {
               type: "Point",
               coordinates:  [ -112.980554,37.209266 ]
            },
            properties: {
            safegraph_place_id:"sg:1fe8d44ad47149618c97069051b154ba",
            location_name:"Zion National Park"
            }
          },
          {
            type: "Feature",
            geometry: {
               type: "Point",
               coordinates:  [ -77.033165,38.712606 ]
            },
            properties: {
            safegraph_place_id:"sg:c11b871760f24551bdd201b7c675fee0",
            location_name:"Fort Washington National Park"
            }
          },
          {
            type: "Feature",
            geometry: {
               type: "Point",
               coordinates:  [ -93.098315,34.514493 ]
            },
            properties: {
            safegraph_place_id:"sg:1ad959f392d94b2b98de6c3cb1daee6c",
            location_name:"Hot Springs National Park"
            }
          },
          {
            type: "Feature",
            geometry: {
               type: "Point",
               coordinates:  [ -84.46666,33.599336 ]
            },
            properties: {
            safegraph_place_id:"sg:917b5d0970004160a137f9d8172d50cf",
            location_name:"Old National Park"
            }
          },
          {
            type: "Feature",
            geometry: {
               type: "Point",
               coordinates:  [ -80.179572,25.880959 ]
            },
            properties: {
            safegraph_place_id:"sg:27195c18e3d241eab42c187267a9280b",
            location_name:"Biscayne Park"
            }
          },
          {
            type: "Feature",
            geometry: {
               type: "Point",
               coordinates:  [ -77.264876,38.938278 ]
            },
            properties: {
            safegraph_place_id:"sg:b28d662fb742474dba7c2594529c4bdc",
            location_name:"Wolf Trap Farm Park National Park"
            }
          },
          {
            type: "Feature",
            geometry: {
               type: "Point",
               coordinates:  [ -110.63942,43.736796 ]
            },
            properties: {
            safegraph_place_id:"sg:75deacb1155b4dcbba46853c37fd478f",
            location_name:"Grand Teton National Park"
            }
          },
          {
            type: "Feature",
            geometry: {
               type: "Point",
               coordinates:  [ -123.439636,48.118895 ]
            },
            properties: {
            safegraph_place_id:"sg:35af1521d33040d2a63d80e2abed2b48",
            location_name:"Experience Olympic"
            }
          },
          {
            type: "Feature",
            geometry: {
               type: "Point",
               coordinates:  [ -105.521732,40.377384 ]
            },
            properties: {
            safegraph_place_id:"sg:ae3763d376d94a5ea5fd186b45bc0ff9",
            location_name:"Rocky Mountain National Park"
            }
          }
        ]
        }
        });

      this.map.addLayer({
        id: 'national_parks',
        type: 'circle',
        source: 'national',
        //layout: {
        //  visibility: 'none',
        //},
        paint: {
          'circle-radius': 8,
          'circle-color': '#40BF45',
          'circle-opacity': 0.7
        },
      });

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
                [4, 10],
                [5, 15],
                [7, 20]
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
