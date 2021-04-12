import React from "react"
import * as am4core from "@amcharts/amcharts4/core";
import * as am4charts from "@amcharts/amcharts4/charts";
import am4themes_animated from "@amcharts/amcharts4/themes/animated";
import Fuse from "fuse.js"

am4core.useTheme(am4themes_animated);

const test_sample =  {
  "safegraph_place_id": "sg:000024a5035444a2aa1ae7594937e4fc",
  "location_name_x": "Vrfa Land Donation",
  "2018-01-01": 33,
  "2018-02-01": 33,
  "2018-03-01": 56,
  "2018-04-01": 35,
  "2018-05-01": 49,
  "2018-06-01": 73,
  "2018-07-01": 117,
  "2018-08-01": 87,
  "2018-09-01": 70,
  "2018-10-01": 74,
  "2018-11-01": 52,
  "2018-12-01": 14,
  "location_name_y": "Vrfa Land Donation",
  "2019-01-01": 26,
  "2019-02-01": 25,
  "2019-03-01": 33,
  "2019-04-01": 48,
  "2019-05-01": 109,
  "2019-06-01": 66,
  "2019-07-01": 100,
  "2019-08-01": 68,
  "2019-09-01": 68,
  "2019-10-01": 55,
  "2019-11-01": 48,
  "2019-12-01": 45,
  "location_name": "Vrfa Land Donation",
  "2020-01-01": 43,
  "2020-02-01": 34,
  "2020-03-01": 51,
  "2020-04-01": 69,
  "2020-05-01": 96,
  "2020-06-01": 123,
  "2020-07-01": 109,
  "2020-08-01": 81,
  "2020-09-01": 83,
  "2020-10-01": 62,
  "2020-11-01": 43,
  "2020-12-01": 56,
  "2021-01-01": 11,
  "2021-02-01": 10,
  "city": "Salem",
  "region": "VA",
  "latitude": 37.244933,
  "longitude": -80.17596400000001
 }

class VisitationChart extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      visitations_data: test_sample,
      parkId: props.parkId,
      parkName: props.parkName
    };
    this.database_patterns = new Fuse(require("../../data/poi_patterns_raw.json"), {
      keys: ['safegraph_place_id'],
      shouldSort: false,
      minMatchCharLength: 10,
      threshold: 0.0
    })
  }

  componentDidMount() {
    let chart = am4core.create("chartdiv", am4charts.XYChart);

    
    let dates = ["2018-01-01", "2018-02-01", "2018-03-01", "2018-04-01", "2018-05-01", "2018-06-01",
    "2018-07-01", "2018-08-01", "2018-09-01", "2018-10-01", "2018-11-01", "2018-12-01", "2019-01-01",
    "2019-02-01", "2019-03-01", "2019-04-01","2019-05-01","2019-06-01","2019-07-01","2019-08-01",
    "2019-09-01","2019-10-01","2019-11-01","2019-12-01","2020-01-01","2020-02-01","2020-03-01","2020-04-01",
    "2020-05-01","2020-06-01","2020-07-01","2020-08-01","2020-09-01","2020-10-01","2020-11-01","2020-12-01","2021-01-01",
    "2021-02-01"]

    chart.paddingRight = 20;

    let data = [];
    
    for (let i = 0; i < dates.length; i++) {
      data.push({ date: new Date(dates[i]), name: "name" + i, value: this.state.visitations_data[dates[i]] });
    }

    chart.data = data;

    var title = chart.titles.create();
    title.text = "Monthly Visitations for Park"; // CHART TITLE
    title.fontWeight = "bold";
    title.fontSize = 16;
    title.fontFamily = "Arial, Sans Serif";

    let dateAxis = chart.xAxes.push(new am4charts.DateAxis());
    dateAxis.renderer.grid.template.location = 0;
    dateAxis.title.text = "Date"; // X-AXIS LABEL
    dateAxis.title.fontSize = 13;
    dateAxis.title.fontFamily = "Arial, Sans Serif";

    let valueAxis = chart.yAxes.push(new am4charts.ValueAxis());
    valueAxis.tooltip.disabled = true;
    valueAxis.title.text = "Monthly Visitation Count"; // Y-AXIS LABEL
    valueAxis.title.fontSize = 13;
    valueAxis.title.fontFamily = "Arial, Sans Serif";

    let series = chart.series.push(new am4charts.LineSeries());
    series.dataFields.dateX = "date";
    series.dataFields.valueY = "value";
    series.strokeWidth = 3;

    series.tooltipText = "{valueY.value}";
    chart.cursor = new am4charts.XYCursor();

    let scrollbarX = new am4charts.XYChartScrollbar();
    scrollbarX.series.push(series);
    chart.scrollbarX = scrollbarX;

    this.title = title;
    this.chart = chart;
  }

  componentWillUnmount() {
    if (this.chart) {
      this.chart.dispose();
    }
    if (this.client) {
      this.client.close();
    }
  }

  componentDidUpdate(prevProps) {
    if (this.props === prevProps || !this.props.parkId || this.props.parkId === prevProps.parkId) {
      return //do nothing if props didn't change
    } else {
      // query for park visitation data from Fuse database
      console.log("searching for visitations data")
      let visitations = this.database_patterns.search(this.props.parkId)[0]
      console.log(visitations)
      let data = [];
      // check for visitations data
      if (visitations) {
        for (const [key, value] of Object.entries(visitations.item)) {
          if (key === 'safegraph_place_id') {continue}
          data.push({ date: new Date(key), name: "name" + key, value: value });
        }
        this.chart.data = data;
        this.title.text = `Monthly Visitations for ${this.props.parkName}`
      } else {
        this.title.text = `Error finding visitations data for ${this.props.parkName}`
      }
      
    }
  }

  render() {
    return (
      <div>
        <div id="chartdiv" style={{ width: "100%", height: "500px" }}></div>
      </div>
    );
  }
}

export default (VisitationChart)
