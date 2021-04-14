import React from "react"
import * as am4core from "@amcharts/amcharts4/core";
import * as am4charts from "@amcharts/amcharts4/charts";
import am4themes_animated from "@amcharts/amcharts4/themes/animated";
import am4themes_material from "@amcharts/amcharts4/themes/material";

am4core.useTheme(am4themes_animated);
am4core.useTheme(am4themes_material);

// load lodash for its isEqual function
//var _ = require("lodash");
const test_sample =  {
  "safegraph_place_id": "sg:000024a5035444a2aa1ae7594937e4fc",
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
  "2021-02-01": 10
 }
 const covid_start = new Date("2/28/2020");

class OverlayChart extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      visitations_data: test_sample,
      parkId: props.parkId,
      parkName: props.parkName,
      parkData: props.parkData
    };
  }

  componentDidMount() {
    let chart = am4core.create("chartdiv", am4charts.XYChart);
    chart.colors.list = [
      am4core.color("#845EC2"),
      am4core.color("#ff3d00")
    ]

    chart.paddingRight = 20;

    let data = [];
    let avg_visitations_precovid = {}
    let avg_visitations_postcovid = {}

    // average precovid/postcovid by month
    // first get list of visitations by month, split between precovid and postcovid
    for (const [key, value] of Object.entries(this.state.visitations_data)) {
      if (key === 'safegraph_place_id') {continue}
      let point_date = new Date(key);
      let point_month = point_date.getMonth();
      if (point_date < covid_start) {
        // if month already present, append point
        if (avg_visitations_precovid[point_month]) {
          avg_visitations_precovid[point_month].push(value)
        } else {
          avg_visitations_precovid[point_month] = [value]
        }
      } else { // same with postcovid data
        if (avg_visitations_postcovid[point_month]) {
          avg_visitations_postcovid[point_month].push(value)
        } else {
          avg_visitations_postcovid[point_month] = [value]
        }
      }
    }
    // convert arrays to their average
    for(const [key, value] of Object.entries(avg_visitations_precovid)) {
      let mean = value.reduce((a,b)=>a+b)/value.length
      avg_visitations_precovid[key] = mean
      data.push({ predate: new Date(2020, key, 1), name: "Pre-2020", precovid: mean });
    }
    for(const [key, value] of Object.entries(avg_visitations_postcovid)) {
      let mean = value.reduce((a,b)=>a+b)/value.length
      avg_visitations_postcovid[key] = mean
      data.push({ postdate: new Date(2020, key, 1), name: "Post-2020", postcovid: mean });
    }
    chart.data = data;

    var title = chart.titles.create();
    title.text = "Pre-Covid/Covid Visitation for "; // CHART TITLE
    title.fontWeight = "bold";
    title.fontSize = 16;
    title.marginBottom = 24;
    title.fontFamily = "Arial, Sans Serif";

    let dateAxis = chart.xAxes.push(new am4charts.DateAxis());
    dateAxis.renderer.grid.template.location = 0;
    dateAxis.renderer.labels.template.location = 0.5;
    dateAxis.title.text = "Month"; // X-AXIS LABEL
    dateAxis.title.fontSize = 13;
    dateAxis.title.fontFamily = "Arial, Sans Serif";
    dateAxis.dateFormats.setKey("day", "MMM");
    dateAxis.periodChangeDateFormats.setKey("day", "MMM");
    dateAxis.periodChangeDateFormats.setKey("month", "MMM");
    dateAxis.gridIntervals.setAll([
      { timeUnit: "month", count: 1 },
      { timeUnit: "month", count: 2 }
    ]);

    let valueAxis = chart.yAxes.push(new am4charts.ValueAxis());
    valueAxis.tooltip.disabled = false;
    valueAxis.title.text = "Average Monthly Visits"; // Y-AXIS LABEL
    valueAxis.title.fontSize = 13;
    valueAxis.title.fontFamily = "Arial, Sans Serif";

    let series = chart.series.push(new am4charts.LineSeries());
    series.dataFields.dateX = "predate";
    series.dataFields.valueY = "precovid";
    series.tooltipText = "{valueY.value}";
    series.strokeWidth = 3;
    series.legendSettings.labelText = "[bold]Pre-Covid[/]";

    let series2 = chart.series.push(new am4charts.LineSeries());
    series2.dataFields.dateX = "postdate";
    series2.dataFields.valueY = "postcovid";
    series2.tooltipText = "{valueY.value}";
    series2.strokeWidth = 3;
    series2.legendSettings.labelText = "[bold]Post-Covid[/]";

    chart.legend = new am4charts.Legend();
    chart.cursor = new am4charts.XYCursor();


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
    // check if parkData is not empty and is not equal to prevProps
    console.log(this.props)
    if (!this.props.parkData || Object.keys(this.props.parkData).length === 0) {
      console.log("parkData is empty")
      return //do nothing if props didn't change
    } else if (prevProps.parkData.safegraph_place_id && this.props.parkData.safegraph_place_id === prevProps.parkData.safegraph_place_id) {
      console.log("parkData has same id as prevProps")
      return
    } else {
      console.log("updating OverlayChart data")
      console.log(this.props.parkData)
      let data = [];
      let avg_visitations_precovid = {}
      let avg_visitations_postcovid = {}

      // average precovid/postcovid by month
      // first get list of visitations by month, split between precovid and postcovid
      for (const [key, value] of Object.entries(this.props.parkData)) {
        let point_date = new Date(key);
        // skip invalid (non-date) keys
        if (isNaN(point_date)) {continue}
        let point_month = point_date.getMonth();
        if (point_date < covid_start) {
          // if month already present, append point
          if (avg_visitations_precovid[point_month]) {
            avg_visitations_precovid[point_month].push(value)
          } else {
            avg_visitations_precovid[point_month] = [value]
          }
        } else { // same with postcovid data
          if (avg_visitations_postcovid[point_month]) {
            avg_visitations_postcovid[point_month].push(value)
          } else {
            avg_visitations_postcovid[point_month] = [value]
          }
        }
      }
      // convert arrays to their average
      for(const [key, value] of Object.entries(avg_visitations_precovid)) {
        let mean = value.reduce((a,b)=>a+b)/value.length
        avg_visitations_precovid[key] = mean
        data.push({ predate: new Date(2020, key, 1), name: "Pre-2020", precovid: mean });
      }
      for(const [key, value] of Object.entries(avg_visitations_postcovid)) {
        let mean = value.reduce((a,b)=>a+b)/value.length
        avg_visitations_postcovid[key] = mean
        data.push({ postdate: new Date(2020, key, 1), name: "Post-2020", postcovid: mean });
      }
      console.log(data)
      this.chart.data = data;
      this.title.text = `Pre-Covid/Covid Visitation for \n ${this.props.parkName}`
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

export default (OverlayChart)
