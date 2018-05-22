import * as React from "react";
import * as PropTypes from "prop-types";

import { DateTime } from "luxon";

import ReactInterval from "react-interval";

export const { Provider, Consumer } = React.createContext(0);

export default class Ticker extends React.Component {
  static propTypes = {
    interval: PropTypes.number.isRequired,
    children: PropTypes.func.isRequired
  };

  static defaultProps = {
    interval: 5000,
    children: () => null
  };

  constructor(props) {
    super(props);
    this.state = { tick: 0, now: DateTime.local().setZone('UTC') };
  }

  componentWillMount() {

  }

  render() {
    return (
      <React.Fragment>
        <ReactInterval
          timeout={this.props.interval}
          enabled={true}
          callback={
            () => {
              this.setState({ tick: this.state.tick + 1, now: DateTime.local().setZone('UTC') });
              this.forceUpdate();
            }
          } />
        {/* <Grid container spacing={16} style={{ marginTop: "1rem" }}>
          <Grid item xs={1}></Grid>
          <Grid item xs={7}>
            <Typography variant="body1">foo</Typography>
          </Grid>
          <Grid item xs={4}>
            <Typography variant="body2">last updated:</Typography><Typography variant="body1">{this.state.now.toISO()}</Typography>
          </Grid>
        </Grid> */}
        <Provider value={this.state.tick}>
          {this.props.children()}
        </Provider>
      </React.Fragment>
    );
  }
}

export function ticking(ComponentType) {
  return class extends React.Component {
    static get name() { return `JSJobsClient(${ComponentType.name})`; }

    render() {
      return (
        <React.Fragment>
          <Consumer>
            {
              value => <ComponentType tick={value} {...this.props} />
            }
          </Consumer>
        </React.Fragment>
      );
    }
  }
}
