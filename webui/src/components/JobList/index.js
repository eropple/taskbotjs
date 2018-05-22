import * as React from "react";
import * as PropTypes from "prop-types";

export class JobList extends React.Component {
  static PropTypes = {
    doFetch: PropTypes.func.isRequired,
    onNextPage: PropTypes.func.isRequired
  };

  render() {
    return null;
  }
}
