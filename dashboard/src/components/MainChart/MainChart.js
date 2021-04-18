import React from "react"
import * as am4core from "@amcharts/amcharts4/core";
import * as am4charts from "@amcharts/amcharts4/charts";
import am4themes_animated from "@amcharts/amcharts4/themes/animated";
import am4themes_material from "@amcharts/amcharts4/themes/material";

am4core.useTheme(am4themes_animated);
am4core.useTheme(am4themes_material);

 const covid_start = new Date("2/28/2020");

class MainChart extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      chartMode: props.chartMode,
      parkName: props.parkName,
      parkData: props.parkData
    };
  }

  // initialize charts
  componentDidMount() {
    // initialize overlayChart
    let chartOverlay = am4core.create("chartdiv-overlay", am4charts.XYChart);
    chartOverlay.colors.list = [
      am4core.color("#845EC2"),
      am4core.color("#ff3d00")
    ]

    chartOverlay.paddingRight = 0;

    let data = []; // temp var to hold data during processing 
    let avg_visitations_precovid = {}
    let avg_visitations_postcovid = {}

    // average precovid/postcovid by month
    // first get list of visitations by month, split between precovid and postcovid
    for (const [key, value] of Object.entries(this.state.parkData)) {
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
    chartOverlay.data = data;

    var titleOverlay = chartOverlay.titles.create();
    titleOverlay.text = "Pre-Covid/Covid Visitations Overlay"; // CHART TITLE
    titleOverlay.fontWeight = "bold";
    titleOverlay.fontSize = 16;
    titleOverlay.marginBottom = 24;
    titleOverlay.align = "center"
    titleOverlay.fontFamily = "Arial, Sans Serif";
    titleOverlay.id = "overlay"

    let dateAxisOverlay = chartOverlay.xAxes.push(new am4charts.DateAxis());
    dateAxisOverlay.renderer.grid.template.location = 0;
    dateAxisOverlay.renderer.labels.template.location = 0.5;
    dateAxisOverlay.title.text = "Month"; // X-AXIS LABEL
    dateAxisOverlay.title.fontSize = 13;
    dateAxisOverlay.title.fontFamily = "Arial, Sans Serif";
    dateAxisOverlay.dateFormats.setKey("day", "MMM");
    dateAxisOverlay.periodChangeDateFormats.setKey("day", "MMM");
    dateAxisOverlay.periodChangeDateFormats.setKey("month", "MMM");
    dateAxisOverlay.gridIntervals.setAll([
      { timeUnit: "month", count: 1 },
      { timeUnit: "month", count: 2 }
    ]);

    let valueAxisMeanMonthly = chartOverlay.yAxes.push(new am4charts.ValueAxis());
    valueAxisMeanMonthly.tooltip.disabled = false;
    valueAxisMeanMonthly.title.text = "Average Monthly Visits"; // Y-AXIS LABEL
    valueAxisMeanMonthly.title.fontSize = 13;
    valueAxisMeanMonthly.title.fontFamily = "Arial, Sans Serif";

    let seriesPrecovid = chartOverlay.series.push(new am4charts.LineSeries());
    seriesPrecovid.dataFields.dateX = "predate";
    seriesPrecovid.dataFields.valueY = "precovid";
    seriesPrecovid.tooltipText = "{valueY.value}";
    seriesPrecovid.strokeWidth = 3;
    seriesPrecovid.legendSettings.labelText = "[bold]Pre-Covid[/]";

    let seriesPostcovid = chartOverlay.series.push(new am4charts.LineSeries());
    seriesPostcovid.dataFields.dateX = "postdate";
    seriesPostcovid.dataFields.valueY = "postcovid";
    seriesPostcovid.tooltipText = "{valueY.value}";
    seriesPostcovid.strokeWidth = 3;
    seriesPostcovid.legendSettings.labelText = "[bold]Post-Covid[/]";

    chartOverlay.legend = new am4charts.Legend();
    chartOverlay.cursor = new am4charts.XYCursor();

    this.titleOverlay = titleOverlay;
    this.chartOverlay = chartOverlay;

    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    // Initialize Line chart
    let chartLine = am4core.create("chartdiv-line", am4charts.XYChart);

    data = [];
    for (const [key, value] of Object.entries(this.state.parkData)) {
      if (key === 'safegraph_place_id') {continue}
      data.push({ date: new Date(key), name: "name" + key, value: value });
    }

    chartLine.data = data;

    var titleLine = chartLine.titles.create();
    titleLine.text = "Monthly Visitations for Park"; // CHART TITLE
    titleLine.fontWeight = "bold";
    titleLine.fontSize = 16;
    titleLine.fontFamily = "Arial, Sans Serif";

    let dateAxisLine = chartLine.xAxes.push(new am4charts.DateAxis());
    dateAxisLine.renderer.grid.template.location = 0;
    dateAxisLine.title.text = "Date"; // X-AXIS LABEL
    dateAxisLine.title.fontSize = 13;
    dateAxisLine.title.fontFamily = "Arial, Sans Serif";

    let valueAxisLine = chartLine.yAxes.push(new am4charts.ValueAxis());
    valueAxisLine.tooltip.disabled = true;
    valueAxisLine.title.text = "Monthly Visitation Count"; // Y-AXIS LABEL
    valueAxisLine.title.fontSize = 13;
    valueAxisLine.title.fontFamily = "Arial, Sans Serif";

    let seriesLine = chartLine.series.push(new am4charts.LineSeries());
    seriesLine.dataFields.dateX = "date";
    seriesLine.dataFields.valueY = "value";
    seriesLine.strokeWidth = 3;

    seriesLine.tooltipText = "{valueY.value}";
    chartLine.cursor = new am4charts.XYCursor();

    let scrollbarLineX = new am4charts.XYChartScrollbar();
    scrollbarLineX.series.push(seriesLine);
    chartLine.scrollbarX = scrollbarLineX;

    this.titleLine = titleLine;
    this.chartLine = chartLine;
  }

  componentWillUnmount() {
    if (this.chartOverlay) {
      this.chartOverlay.dispose();
    }
    if (this.chartLine) {
      this.chartLine.dispose();
    }
    if (this.client) {
      this.client.close();
    }
  }

  componentDidUpdate(prevProps) {
    console.log("MainChart did update")
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
      this.chartOverlay.data = data;
      this.titleOverlay.text = `Pre-Covid/Covid Visitations Overlay\n ${this.props.parkName}`
    }
  }

  render() {
    return (
      <div>
        <div id="chartdiv-overlay" style={{ width: "400px", height: "420px", display: this.state.chartMode === "overlay" ? "block" : "none"}}></div>
        <div id="chartdiv-line" style={{ width: "400px", height: "420px", display: this.state.chartMode === "line" ? "block" : "none"}}></div>
      </div>
    );
  }
}

export default (MainChart)
