import * as React from "react";

import Grid from "@material-ui/core/Grid";

import Sets from "./Sets";
import Queues from "./Queues";
import StorageMetrics from "./StorageMetrics";
import AtAGlance from "./AtAGlance";
// import MetricChart from "./MetricChart";
import Workers from "./Workers";
import DevNote from "./DevNote";

export default class Dashboard extends React.Component {
  render() {
    return (
      <Grid container spacing={16}>
        <Grid item xs={3}>
          <Sets />
          <Queues />
          <StorageMetrics />
        </Grid>
        <Grid item xs={9}>
          <AtAGlance />
          {/* <MetricChart /> */}
          <Workers />
          <DevNote />
        </Grid>
      </Grid>
    );
  }
}
