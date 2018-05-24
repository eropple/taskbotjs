import * as React from "react";

import Paper from "@material-ui/core/Paper";
import Typography from "@material-ui/core/Typography";
import {
  // LineChart as Line
} from "react-chartjs";

import Spinner from "../../Spinner";
import { withClient } from "../../TaskBotJSClient";
import { ticking } from "../../Ticker";

export class MetricChart extends React.Component {
  static DEFAULT_STATE = { data: null, error: null };

  constructor(props) {
    super(props);

    this.state = MetricChart.DEFAULT_STATE;
  }

  componentWillMount() {
    this._fetch(this.props.client);
  }

  componentWillReceiveProps(nextProps) {
    if (nextProps.tick !== this.props.tick) {
      this._fetch(this.props.client);
    }
  }

  async _fetch(client) {
    try {
      // const resp = await client.get("/metrics/basic");
      const data = {};

      this.setState({ data, error: null });
    } catch (err) {
      console.error(err);
      this.setState({ error: err });
    }
  }

  render() {
    const { data } = this.state;

    return (
      <Paper style={{ padding: "1rem", marginBottom: "2rem" }}>
        <Typography variant="headline">
          Daily Metrics
        </Typography>
        {
          data
            ? this._renderData(data)
            : <Spinner />
        }
      </Paper>
    );
  }

  _renderData(data) {
    return (
      <Typography variant="body2">
        TODO: dated metrics chart here
      </Typography>
    );
  }
}

export default ticking(withClient(MetricChart));
