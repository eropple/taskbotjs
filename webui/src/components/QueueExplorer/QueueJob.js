import * as React from "react";
import {
  withRouter
} from "react-router-dom";
import * as PropTypes from "prop-types";

import Grid from "@material-ui/core/Grid";
import Typography from "@material-ui/core/Typography";
import Button from "@material-ui/core/Button";

import Spinner from "../Spinner";

import JobTable from "../JobTable";

import { ticking } from "../Ticker";
import { withClient } from "../TaskBotJSClient";

export class QueueJob extends React.Component {
  static propTypes = {
    queueName: PropTypes.string.isRequired,
    jobId: PropTypes.string.isRequired,
    client: PropTypes.any.isRequired,
    history: PropTypes.any.isRequired,
    pageHint: PropTypes.number
  };

  static DEFAULT_STATE = {
    job: null
  };

  constructor(props) {
    super(props);
    console.log(props)

    this.state = QueueJob.DEFAULT_STATE;
  }

  componentWillMount() {
    this._fetch();
  }

  componentWillReceiveProps(nextProps) {
    if (this.props.tick !== nextProps.tick || this.props.jobId !== nextProps.jobId) {
      this._fetch();
    }
  }

  async _fetch() {
    try {
      const { queueName, jobId, client, pageHint } = this.props;
      let job = null;

      if (pageHint) {
        // TODO: roll page hint fetching into webapi
        const offset = (pageHint - 1) * 10;
        const limit = 10;

        const peekItems = (await client.get(`/queues/${queueName}?limit=${limit}&offset=${offset}`)).data;

        job = peekItems.find((item) => item.id === jobId);
      }

      if (!job) {
        job = (await client.get(`/queues/${queueName}/${jobId}`)).data;
      }

      this.setState({ job, error: null });
    } catch (error) {
      console.error(error);
      this.setState({ error });
    }
  }

  render() {
    const { job } = this.state;

    if (!job) {
      return <Spinner />
    } else {
      return (
        <React.Fragment>
          <Grid container spacing={16}>
            <Grid item xs={10}>
              <Typography variant="headline">Job <em>{job.id}</em> from <em>{job.options.queue}</em></Typography>
            </Grid>
            <Grid item xs={2}>
              <Button
                  size="small"
                  variant="raised"
                  color="primary"
                  style={{ marginLeft: "1rem" }}
                  onClick={() => this._launch()}>
                Launch
              </Button>
              <Button
                  size="small"
                  color="default"
                  style={{ marginLeft: "1rem" }}
                  onClick={() => this._delete()}>
                Delete
              </Button>
            </Grid>
          </Grid>
          <JobTable job={job} />
        </React.Fragment>
      );
    }
  }

  async _launch() {
    const { client, history } = this.props;
    const { job } = this.state;

    try {
      await client.post(`/queues/${job.options.queue}/${job.id}/launch`);
      history.push(`/queues/${job.options.queue}`);
    } catch (error) {
      console.error(error);
      this.setState({ error });
    }
  }

  async _delete() {
    const { client, history } = this.props;
    const { job } = this.state;

    try {
      await client.delete(`/queues/${job.options.queue}/${job.id}`);
      history.replace(`/queues/${job.options.queue}`);
    } catch (error) {
      console.error(error);
      this.setState({ error });
    }
  }
}

export default ticking(withClient(withRouter(QueueJob)));
