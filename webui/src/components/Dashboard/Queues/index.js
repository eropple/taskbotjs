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
import { withClient } from "../../JSJobsClient";
import { ticking } from "../../Ticker";

export class Queues extends React.Component {
  static DEFAULT_STATE = { queues: null, error: null };

  constructor(props) {
    super(props);

    this.state = Queues.DEFAULT_STATE;
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
      const resp = await client.get("/queues");
      const queues = resp.data;

      this.setState({ queues, error: null });
    } catch (err) {
      console.error(err);
      this.setState({ error: err });
    }
  }

  render() {
    const { queues } = this.state;

    return (
      <Paper style={{ padding: "1rem", marginBottom: "2rem" }}>
        <Typography variant="headline">
          Queues
        </Typography>
        {
          queues
            ? this._renderQueues(queues)
            : <Spinner />
        }
      </Paper>
    );
  }

  _renderQueues(queues) {
    return (
      <Table>
        <TableBody>
          {
            queues.map(
              (queue) => {
                const link = `/queues/${queue.name}`;

                return (
                  <TableRow key={queue.name}>
                    <TableCell>
                      <Typography variant="body2" component={Link} to={link}>
                        {queue.name}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body1" component={Link} to={link}>
                        {queue.size}
                      </Typography>
                    </TableCell>
                  </TableRow>
                );
              }
            )
          }
        </TableBody>
      </Table>
    );
  }
}

export default ticking(withClient(Queues));
