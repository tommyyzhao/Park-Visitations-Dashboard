import React from "react"
import * as am4core from "@amcharts/amcharts4/core";
import * as am4charts from "@amcharts/amcharts4/charts";
import am4themes_animated from "@amcharts/amcharts4/themes/animated";

am4core.useTheme(am4themes_animated);


class VisitationChart extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      parkData: props.parkData,
      parkId: props.parkId,
      parkName: props.parkName
    };
  }

  componentDidMount() {
    let chart = am4core.create("chartdiv", am4charts.XYChart);
    chart.paddingRight = 20;

    let data = [];
    for (const [key, value] of Object.entries(this.state.parkData)) {
      if (key === 'safegraph_place_id') {continue}
      data.push({ date: new Date(key), name: "name" + key, value: value });
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
    console.log("VisitationChart did update")
    console.log(this.props)
    if (!this.props.parkData || Object.keys(this.props.parkData).length === 0) {
      console.log("parkData is empty")
      return //do nothing if props didn't change
    } else if (prevProps.parkData.safegraph_place_id && this.props.parkData.safegraph_place_id === prevProps.parkData.safegraph_place_id) {
      console.log("parkData has same id as prevProps")
      return
    } else {
      // query for park visitation data from Fuse database
      let data = [];
      console.log("updating visitations chart")
      for (const [key, value] of Object.entries(this.props.parkData)) {
        let point_date = new Date(key);
        if (isNaN(point_date)) {continue}

        data.push({ date: point_date, name: "name" + key, value: value });
      }
        this.chart.data = data;
        this.title.text = `Monthly Visitations for \n ${this.props.parkName}`
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
