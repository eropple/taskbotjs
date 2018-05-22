import * as React from "react";
import Typography from "@material-ui/core/Typography";

export default class NotFound extends React.Component {
  render() {
    return (
      <React.Fragment>
        <Typography>
          Not Found
        </Typography>
        <Typography>
          I couldn't find what you're looking for. If you reached this page through a link
          inside the JSJobs control panel, it would be really awesome if you could <a
          href="https://github.com/eropple/jsjobs/issues" rel="noopener noreferrer"
          target="_blank">file a bug</a>.
        </Typography>
      </React.Fragment>
    );
  }
}
