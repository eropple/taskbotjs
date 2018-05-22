import * as React from "react";

import Typography from "@material-ui/core/Typography";
import Table from "@material-ui/core/Table";
import TableBody from "@material-ui/core/TableBody";
import TableRow from "@material-ui/core/TableRow";
import TableCell from "@material-ui/core/TableCell";

import { Duration } from "luxon";

export default class RedisMetrics extends React.Component {
  render() {
    const { metrics } = this.props;

    return (
      <React.Fragment>
        <Table>
          <TableBody>
            {this._makeRow("Redis", metrics.redisVersion)}
            {this._makeRow("Mode", metrics.redisMode)}
            {this._makeRow("Uptime",
              this._durationToString(metrics.uptimeInSeconds))}
            {this._makeRow("Used Memory", metrics.usedMemoryHuman)}
            {this._makeRow("Peak Memory", metrics.usedMemoryPeakHuman)}
            {this._makeRow("Fragmentation Ratio", metrics.memFragmentationRatio)}
          </TableBody>
        </Table>
      </React.Fragment>
    );
  }

  _makeRow(caption, value) {
    return (
      <TableRow>
        <TableCell>
          <Typography variant="body2">
            {caption}
          </Typography>
        </TableCell>
        <TableCell>
          <Typography variant="body1">
            {value || "not provided"}
          </Typography>
        </TableCell>
      </TableRow>
    );
  }

  _durationToString(uptimeInSeconds) {
    const duration = Duration.fromObject({
      days: 0, hours: 0, minutes: 0, seconds: uptimeInSeconds
    });
    const d = duration.normalize().toObject();
    return [
      d.days,
      "d ",
      d.hours,
      "h ",
      d.minutes,
      "m ",
      d.seconds,
      "s"
    ].join("");
  }
}
