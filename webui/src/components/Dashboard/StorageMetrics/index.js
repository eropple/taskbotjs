import * as React from "react";

import Paper from "@material-ui/core/Paper";
import { Typography } from "@material-ui/core";

import Spinner from "../../Spinner";
import { withClient } from "../../JSJobsClient";
import { ticking } from "../../Ticker";

import RedisMetrics from "./RedisMetrics";

export class StorageMetrics extends React.Component {
  static DEFAULT_STATE = { storageMetrics: null, error: null };

  constructor(props) {
    super(props);

    this.state = StorageMetrics.DEFAULT_STATE;
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
      const resp = await client.get("/metrics/storage");
      const storageMetrics = resp.data;

      this.setState({ storageMetrics, error: null });
    } catch (err) {
      console.error(err);
      this.setState({ error: err });
    }
  }

  render() {
    const { storageMetrics } = this.state;

    return (
      <Paper style={{ padding: "1rem", marginBottom: "2rem" }}>
        <Typography variant="headline">
          Storage Metrics
        </Typography>
        {
          storageMetrics
            ? this._renderMetrics(storageMetrics)
            : <Spinner />
        }
      </Paper>
    );
  }

  _renderMetrics(storageMetrics) {
    switch (storageMetrics.type) {
      case "redis":
        return <RedisMetrics metrics={storageMetrics.data} />;
      default:
        throw new Error(`Unrecognized storage metrics type: ${storageMetrics.type}`);
    }
  }
}

export default ticking(withClient(StorageMetrics));
