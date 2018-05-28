import * as React from "react";
import {
  Link
} from "react-router-dom";
import * as PropTypes from "prop-types";

import { DateTime } from "luxon";

import Typography from "@material-ui/core/Typography";
import Table from "@material-ui/core/Table";
import TableBody from "@material-ui/core/TableBody";
import TableRow from "@material-ui/core/TableRow";
import TableCell from "@material-ui/core/TableCell";
import { formatToFullDate } from "../util/time";

export default class JobTable extends React.Component {
  static propTypes = {
    job: PropTypes.object.isRequired
  };

  render() {
    const { job } = this.props;

    return (
      <React.Fragment>
        <Typography variant="subheading">Details</Typography>
          <Table>
            <TableBody>
              <TableRow>
                <TableCell>
                  <Typography variant="body2">Job Name</Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body1">{job.name}</Typography>
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>
                  <Typography variant="body2">Arguments</Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body1" style={{ fontFamily: "monospace" }}>{JSON.stringify(job.args)}</Typography>
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>
                  <Typography variant="body2">Queue Name</Typography>
                </TableCell>
                <TableCell>
                  <Typography
                      variant="body1"
                      component={Link}
                      to={`/queues/${job.options.queue}`}>
                    {job.options.queue}
                  </Typography>
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>
                  <Typography variant="body2">Created At</Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body1">{this._timeFormat(job.createdAt)}</Typography>
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>
                  <Typography variant="body2">Source</Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body1">{job.source}</Typography>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
          {
            job.status
              ? <React.Fragment>
                  <Typography variant="subheading">Status</Typography>
                  <Table>
                    <TableBody>
                      <TableRow>
                        <TableCell>
                          <Typography variant="body2">Last Run Start</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body1">{this._timeFormat(job.status.startedAt)}</Typography>
                        </TableCell>
                      </TableRow>
                      {
                        job.status.endedAt
                          ? <TableRow>
                              <TableCell>
                                <Typography variant="body2">Last Run End</Typography>
                              </TableCell>
                              <TableCell>
                                <Typography variant="body1">{this._timeFormat(job.status.endedAt)}</Typography>
                              </TableCell>
                            </TableRow>
                          : null
                      }
                      <TableRow>
                        <TableCell>
                          <Typography variant="body2">Retry Count</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body1">{job.status.retry}</Typography>
                        </TableCell>
                      </TableRow>
                      {
                        job.status.nextRetryAt
                          ? <TableRow>
                              <TableCell>
                                <Typography variant="body2">Next Retry Time</Typography>
                              </TableCell>
                              <TableCell>
                                <Typography variant="body1">{this._timeFormat(job.status.nextRetryAt)}</Typography>
                              </TableCell>
                            </TableRow>
                          : null
                      }
                      {
                        job.status.error
                          ? <TableRow>
                              <TableCell>
                                <Typography variant="body2">Error</Typography>
                              </TableCell>
                              <TableCell>
                                <pre>
                                  {job.status.error.message}

                                  {(job.status.error.backtrace || []).join("\n")}
                                </pre>
                              </TableCell>
                            </TableRow>
                          : null
                      }
                    </TableBody>
                  </Table>
                </React.Fragment>
              : null
          }
      </React.Fragment>
    );
  }

  _timeFormat(timestamp) {
    const dt = DateTime.fromMillis(timestamp, { zone: "UTC" });

    return formatToFullDate(dt);
  }
}
