import * as React from "react";
import {
  Link
} from "react-router-dom";
import * as PropTypes from "prop-types";

import Grid from "@material-ui/core/Grid";
import Typography from "@material-ui/core/Typography";
import Button from "@material-ui/core/Button";
import Table from "@material-ui/core/Table";
import TableHead from "@material-ui/core/TableHead";
import TableBody from "@material-ui/core/TableBody";
import TableRow from "@material-ui/core/TableRow";
import TableCell from "@material-ui/core/TableCell";

import Spinner from "../Spinner";

import { ticking } from "../Ticker";
import { withClient } from "../JSJobsClient";

export class QueueExplorer extends React.Component {
  static PAGE_SIZE = 10;
  static DEFAULT_STATE = {
    size: null
  };

  static propTypes = {
    tick: PropTypes.number.isRequired,
    client: PropTypes.any.isRequired,
    queueName: PropTypes.string.isRequired,
    pageNumber: PropTypes.number.isRequired
  };

  constructor(props) {
    super(props);

    this.state = QueueExplorer.DEFAULT_STATE;
  }

  componentWillMount() {
    this._query(this.props.pageNumber);
  }

  componentWillReceiveProps(nextProps) {
    if (this.props.tick !== nextProps.tick || this.props.pageNumber !== nextProps.pageNumber) {
      this._query(nextProps.pageNumber);
    }
  }

  async _query(pageNumber) {
    const { client, queueName } = this.props;

    const offset = (pageNumber - 1) * QueueExplorer.PAGE_SIZE;
    const limit = QueueExplorer.PAGE_SIZE;

    // TODO: add a get-just-one-queue-length function to webapi.
    const size = (await client.get("/queues")).data.find((queue) => queue.name === queueName).size;
    const jobs = (await client.get(`/queues/${queueName}?limit=${limit}&offset=${offset}`)).data;

    this.setState({
      size,
      jobs
    });
  }

  render() {
    const { queueName, pageNumber } = this.props;
    const { size, jobs } = this.state;

    const prevPage = pageNumber - 1;
    const hasPrevious = prevPage >= 1;
    const nextPage = pageNumber + 1;
    const hasNext = ((pageNumber) * QueueExplorer.PAGE_SIZE) <= size;
    const lastPage = Math.floor(size / QueueExplorer.PAGE_SIZE) + 1;

    const pager = (
      <Grid container spacing={16} style={{ margin: "0.5rem 0" }}>
        <Grid item xs={1} />
        <Grid item xs={2}>
          { hasPrevious
            ? <React.Fragment>
                <Button
                    size="small"
                    variant="raised"
                    color="secondary"
                    component={Link}
                    to={`/queues/${queueName}/page/1`}>
                  First
                </Button>
                <Button
                    size="small"
                    variant="raised"
                    color="secondary"
                    component={Link}
                    to={`/queues/${queueName}/page/${prevPage}`}
                    style={{ marginLeft: "0.5rem" }}>
                  Previous
                </Button>
              </React.Fragment>
            : null
          }
        </Grid>
        <Grid item xs={6}>
          <Typography variant="subheading" style={{ textAlign: "center" }}>
            Page {pageNumber} of {lastPage}
          </Typography>
        </Grid>
        <Grid item xs={2}>
          { hasNext
            ? <React.Fragment>
                <Button
                    size="small"
                    variant="raised"
                    color="secondary"
                    component={Link}
                    to={`/queues/${queueName}/page/${nextPage}`}>
                  Next
                </Button>
                <Button
                    size="small"
                    variant="raised"
                    color="secondary"
                    component={Link}
                    to={`/queues/${queueName}/page/${lastPage}`}
                    style={{ marginLeft: "0.5rem" }}>
                  Last
                </Button>
              </React.Fragment>
            : null
          }
        </Grid>
        <Grid item xs={1} />
      </Grid>
    );

    if (size) {
      return (
        <React.Fragment>
          <Typography variant="headline">
            Queue <em>{queueName}</em> (size: <em>{size}</em>)
          </Typography>
          {pager}
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>
                  <Typography variant="subheading">ID</Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="subheading">Job Name</Typography>
                </TableCell>
                <TableCell style={{flex: 1}}>
                  <Typography variant="subheading">Arguments</Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="subheading">Commands</Typography>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {
                jobs.map((job, idx) => {
                  return (
                    <TableRow key={job.id + "-" + idx}>
                      <TableCell>
                        <Typography
                            variant="body1"
                            component={Link}
                            to={`/queues/${queueName}/jobs/${job.id}?pageHint=${pageNumber}`}>
                          {job.id}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body1">{job.name}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body1" noWrap style={{ fontFamily: "monospace" }}>{JSON.stringify(job.args)}</Typography>
                      </TableCell>
                      <TableCell>
                        <Button
                            size="small"
                            variant="raised"
                            color="primary"
                            style={{ marginLeft: "1rem" }}
                            onClick={() => this._launch(job)}>
                          Launch
                        </Button>
                        <Button
                            size="small"
                            color="default"
                            style={{ marginLeft: "1rem" }}
                            onClick={() => this._delete(job)}>
                          Delete
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              }
            </TableBody>
          </Table>
          {pager}
        </React.Fragment>
      );
    } else {
      return <Spinner />;
    }
  }

  async _launch(job) {
    const { client, pageNumber } = this.props;

    try {
      await client.post(`/queues/${job.options.queue}/${job.id}/launch`);
      this._query(pageNumber);
    } catch (error) {
      console.error(error);
      this.setState({ error });
    }
  }

  async _delete(job) {
    const { client, pageNumber } = this.props;

    try {
      await client.delete(`/queues/${job.options.queue}/${job.id}`);
      this._query(pageNumber);
    } catch (error) {
      console.error(error);
      this.setState({ error });
    }
  }
}

export default ticking(withClient(QueueExplorer));
