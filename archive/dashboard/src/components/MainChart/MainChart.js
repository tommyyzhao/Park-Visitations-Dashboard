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

  // Using AmCharts 4 (https://www.amcharts.com/docs/v4/getting-started/integrations/using-react/)
  // initialize charts
  componentDidMount() {
    // initialize overlayChart
    let chartOverlay = am4core.create("chartdiv-overlay", am4charts.XYChart);
    chartOverlay.colors.list = [
      am4core.color("#845EC2"),
      am4core.color("#ff3d00")
    ]

    chartOverlay.paddingRight = 0;

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

    this.chartOverlay = chartOverlay;

    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~\
    // Initialize Line chart
    let chartLine = am4core.create("chartdiv-line", am4charts.XYChart);

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
    // switch chartMode when chartMode prop changes
    if (this.props.chartMode && this.props.chartMode !== prevProps.chartMode) {
      this.setState({chartMode: this.props.chartMode})
    }
    if (!this.props.parkData || Object.keys(this.props.parkData).length === 0) {
      console.log("parkData is empty")
      this.chartOverlay.data = [];
      this.chartLine.data = [];
      return //do nothing if props didn't change
    } else if (prevProps.parkData && prevProps.parkData.safegraph_place_id && this.props.parkData.safegraph_place_id === prevProps.parkData.safegraph_place_id) {
      console.log("parkData has same id as prevProps")
      return
    } else {
      // update parkName state
      this.setState({parkName: this.props.parkName})
      // update data for AmCharts
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
      this.chartOverlay.data = data;

      // update Line Chart data
      data = [];
      for (const [key, value] of Object.entries(this.props.parkData)) {
        let point_date = new Date(key);
        if (isNaN(point_date)) {continue}
        data.push({ date: point_date, name: "name" + key, value: value });
      }
      this.chartLine.data = data;

    }

  }

  render() {
    return (
      <div style={{ width: "100%", borderStyle: 'solid none dotted none', borderWidth: '1px', margin: "0 0 0 10px"}}>
        <h4 style={{ textAlign: 'right', margin:'auto', padding: '10px 10px 0 0', display: this.state.chartMode === "overlay" ? "block" : "none"}}>Pre-Covid vs. Post-Covid Visitations</h4>
        <h4 style={{ textAlign: 'right', margin:'auto', padding: '10px 10px 0 0', display: this.state.chartMode === "line" ? "block" : "none"}}>Monthly Visitors Line Chart</h4>
        <h4 style={{ textAlign: 'right', margin:'auto', padding: '10px 10px 0 0', display: this.state.chartMode === "origin" ? "block" : "none"}}>Visitor Origin Chart (work-in-progress)</h4>
        <h4 style={{ textAlign: 'right', margin:'auto', padding: '0 10px'}}> ({this.state.parkName})</h4>
        <div id="chartdiv-overlay" style={{ width: "100%", height: "420px", marginTop: "5px", display: this.state.chartMode === "overlay" ? "block" : "none"}}></div>
        <div id="chartdiv-line" style={{ width: "100%", height: "420px", marginTop: "5px", display: this.state.chartMode === "line" ? "block" : "none"}}></div>
      </div>
    );
  }
}

export default (MainChart)
