import React from 'react';
import Typography from '@material-ui/core/Typography';
import Box from '@material-ui/core/Box';
import PropTypes from 'prop-types';
import { withStyles } from '@material-ui/core/styles';
import Slider from '@material-ui/core/Slider';
import Tooltip from '@material-ui/core/Tooltip';

const styles = theme => ({
    root: {
        width: '97%',
        marginTop: 15
    },
    type: {
        fontFamily: 'Roboto',
        color: '#777',
        fontSize: 13,
        opacity: 1
    },
    margin: {
        height: theme.spacing(3),
    },
    tooltip: {
        fontSize: 12
    }
});

class CustomizedSlider extends React.Component {

    constructor(props) {
        super(props);
        this.timeMarks = [
            {
              value: 0,
              tooltip: '2019-07'
            },
            {
              value: 1,
              tooltip: '2019-08'
            },
            {
              value: 2,
              tooltip: '2019-09'
            },
            {
              value: 3,
              tooltip: '2019-10'
            },
            {
              value: 4,
              tooltip: '2019-11'
            },
            {
              value: 5,
              tooltip: '2019-12'
            },
            {
              value: 6,
              tooltip: '2020-01'
            },
            {
              value: 7,
              tooltip: '2020-02'
            },
            {
              value: 8,
              tooltip: '2020-03'
            },
            {
              value: 9,
              tooltip: '2020-04'
            },
            {
              value: 10,
              tooltip: '2020-05'
            },
            {
              value: 11,
              tooltip: '2020-06'
            },
            {
              value: 12,
              tooltip: '2020-07'
            },
            {
              value: 13,
              tooltip: '2020-08'
            },
            {
              value: 14,
              tooltip: '2020-09'
            },
            {
              value: 15,
              tooltip: '2020-10'
            },
            {
              value: 16,
              tooltip: '2020-11'
            },
            {
              value: 17,
              tooltip: '2020-12'
            },
          ]
      }

    ValueLabelComponent = (props) => {
        const { children, value } = props;
        const { classes } = this.props;

        this.label = ''
        this.timeMarks.forEach(mark => {
            if (mark.value === value) {
                this.label = mark.tooltip;
            }
        })

        return (
            <Tooltip classes={{
                tooltip: classes.tooltip
            }} open={true} placement="top" title={this.label} >
                {children}
            </Tooltip>
        );
    }

    handleChange = (event, newValue) => {
        this.props.setSearch({ timeRange: newValue });
    }

    render() {

        const { classes } = this.props;

        this.ValueLabelComponent.propTypes = {
            children: PropTypes.element.isRequired,
            value: PropTypes.number.isRequired,
        }

        return (
            <Typography component="div" className={classes.root}>
                <Box fontWeight="fontWeightBold" className="BoxText">Time Search</Box>
                <Slider
                    className="Time-slider"
                    ValueLabelComponent={this.ValueLabelComponent}
                    defaultValue={[0, 11]}
                    min={0}
                    max={17}
                    step={1}
                    onChangeCommitted={this.handleChange}
                    marks={this.timeMarks}
                >
                </Slider>
            </Typography>
        );
    }

}
export default withStyles(styles)(CustomizedSlider);