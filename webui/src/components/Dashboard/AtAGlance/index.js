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

export class AtAGlance extends React.Component {
  static DEFAULT_STATE = { data: null, error: null };

  constructor(props) {
    super(props);

    this.state = AtAGlance.DEFAULT_STATE;
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
      const data = resp.data;

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
        {
        /* <Typography variant="headline">
          At A Glance
        </Typography> */
        }
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
      <Table>
        <TableBody>
          <TableRow>
            <TableCell>
              <Typography variant="body2">Processed</Typography>
            </TableCell>
            <TableCell>
              <Typography variant="body2">Errored</Typography>
            </TableCell>
            <TableCell>
              <Typography variant="body2">Enqueued</Typography>
            </TableCell>
            <TableCell>
              <Typography variant="body2" component={Link} to="/scheduled">
                Scheduled
              </Typography>
            </TableCell>
            <TableCell>
              <Typography variant="body2" component={Link} to="/retry">
                Retries
              </Typography>
            </TableCell>
            <TableCell>
              <Typography variant="body2" component={Link} to="/dead">
                Dead
              </Typography>
            </TableCell>
          </TableRow>
          <TableRow>
            <TableCell>
              <Typography variant="body1">{data.totalProcessed}</Typography>
            </TableCell>
            <TableCell>
              <Typography variant="body1">{data.totalErrored}</Typography>
            </TableCell>
            <TableCell>
              <Typography variant="body1">{data.enqueued}</Typography>
            </TableCell>
            <TableCell>
              <Typography variant="body1" component={Link} to="/scheduled">
                {data.scheduledSetSize}
              </Typography>
            </TableCell>
            <TableCell>
              <Typography variant="body1"  component={Link} to="/retry">
                {data.retrySetSize}
              </Typography>
            </TableCell>
            <TableCell>
              <Typography variant="body1"  component={Link} to="/dead">
                {data.deadSetSize}
              </Typography>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );
  }
}

export default ticking(withClient(AtAGlance));
