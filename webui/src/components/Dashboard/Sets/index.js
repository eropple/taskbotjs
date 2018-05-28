import * as React from "react";
import {
  Link
} from "react-router-dom";

import Paper from "@material-ui/core/Paper";
import Typography from "@material-ui/core/Typography";
import Table from "@material-ui/core/Table";
import TableBody from "@material-ui/core/TableBody";
import TableRow from "@material-ui/core/TableRow";
import TableCell from "@material-ui/core/TableCell";

import Spinner from "../../Spinner";
import { withClient } from "../../TaskBotJSClient";
import { ticking } from "../../Ticker";

export class Sets extends React.Component {
  static DEFAULT_STATE = { metrics: null, error: null };

  constructor(props) {
    super(props);

    this.state = Sets.DEFAULT_STATE;
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
      const resp = await client.get("/metrics/basic");
      const metrics = resp.data;

      this.setState({ metrics, error: null });
    } catch (err) {
      console.error(err);
      this.setState({ error: err });
    }
  }

  render() {
    const { metrics } = this.state;

    return (
      <Paper style={{ padding: "1rem", marginBottom: "2rem" }}>
        <Typography variant="headline">
          Sets
        </Typography>
        {
          metrics
            ? this._renderSets(metrics)
            : <Spinner />
        }
      </Paper>
    );
  }

  _renderSets(metrics) {
    return (
      <Table>
        <TableBody>
          <TableRow>
            <TableCell>
              <Typography variant="body2" component={Link} to="/scheduled">
                Scheduled
              </Typography>
            </TableCell>
            <TableCell>
              <Typography variant="body1" component={Link} to="/scheduled">
                {metrics.scheduledSetSize}
              </Typography>
            </TableCell>
          </TableRow>
          <TableRow>
            <TableCell>
              <Typography variant="body2" component={Link} to="/retry">
                Retries
              </Typography>
            </TableCell>
            <TableCell>
              <Typography variant="body1" component={Link} to="/retry">
                {metrics.retrySetSize}
              </Typography>
            </TableCell>
          </TableRow>
          <TableRow>
            <TableCell>
              <Typography variant="body2" component={Link} to="/done">
                Done
              </Typography>
            </TableCell>
            <TableCell>
              <Typography variant="body1" component={Link} to="/done">
                {metrics.doneSetSize}
              </Typography>
            </TableCell>
          </TableRow>
          <TableRow>
            <TableCell>
              <Typography variant="body2" component={Link} to="/dead">
                Dead
              </Typography>
            </TableCell>
            <TableCell>
              <Typography variant="body1" component={Link} to="/dead">
                {metrics.deadSetSize}
              </Typography>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );
  }
}

export default ticking(withClient(Sets));
