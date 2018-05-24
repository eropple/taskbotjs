import * as React from "react";

import Grid from "@material-ui/core/Grid";
import Button from "@material-ui/core/Button";
import Paper from "@material-ui/core/Paper";
import Typography from "@material-ui/core/Typography";
import Table from "@material-ui/core/Table";
import TableHead from "@material-ui/core/TableHead";
import TableBody from "@material-ui/core/TableBody";
import TableRow from "@material-ui/core/TableRow";
import TableCell from "@material-ui/core/TableCell";

import Spinner from "../../Spinner";
import { ticking } from "../../Ticker";
import { withClient } from "../../TaskBotJSClient";
import { formatToRelativeTime } from "../../../util/time";
import { DateTime } from "luxon";

export class Workers extends React.Component {
  static DEFAULT_STATE = { workers: null, error: null };

  constructor(props) {
    super(props);

    this.state = Workers.DEFAULT_STATE;
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
      const resp = await client.get("/workers");
      const workers = resp.data;

      this.setState({ workers, error: null });
    } catch (err) {
      console.error(err);
      this.setState({ error: err });
    }
  }

  render() {
    const { workers } = this.state;

    return (
      <Paper style={{ padding: "1rem", marginBottom: "2rem" }}>
        <Grid container spacing={16}>
          <Grid item xs={8}>
            <Typography variant="headline">
              Workers { workers ? `(${workers.length})` : "..." }
            </Typography>
          </Grid>
          <Grid item xs={4} style={{ textAlign: "right" }}>
            <Button
                variant="raised"
                color="secondary"
                onClick={() => this._clean()}>
              Clean Old Workers
            </Button>
          </Grid>
        </Grid>
        {
          workers
            ? this._renderWorkers(workers)
            : <Spinner />
        }
      </Paper>
    );
  }

  async _clean() {
    const { client } = this.props;

    try {
      await client.post("/workers/cleanup");
      this._fetch(client);
    } catch (error) {
      console.error(error);
      this.setState({ error });
    }
  }

  _renderWorkers(workers) {
    return (
      <Table>
        <TableHead>
          <TableRow>
            <TableCell><Typography variant="body2">Name</Typography></TableCell>
            <TableCell><Typography variant="body2">Last Report</Typography></TableCell>
            <TableCell><Typography variant="body2">Active Workers</Typography></TableCell>
            <TableCell><Typography variant="body2">Concurrency</Typography></TableCell>
            <TableCell><Typography variant="body2">Version</Typography></TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {
            workers.map((w) =>
              <TableRow>
                <TableCell><Typography variant="body1">{w.name}</Typography></TableCell>
                <TableCell><Typography variant="body1">{this._timeFormat(w.lastBeat)}</Typography></TableCell>
                <TableCell><Typography variant="body1">{w.active}</Typography></TableCell>
                <TableCell><Typography variant="body1">{w.concurrency}</Typography></TableCell>
                <TableCell><Typography variant="body1">{w.version}/{w.flavor}</Typography></TableCell>
              </TableRow>)
          }
        </TableBody>
      </Table>
    );
  }

  _timeFormat(timestamp) {
    const relMs = DateTime.utc().valueOf() - timestamp;
    return `${formatToRelativeTime(DateTime.fromMillis(timestamp, { zone: "UTC" }))} (${relMs} ms)`;
  }
}

export default ticking(withClient(Workers));
