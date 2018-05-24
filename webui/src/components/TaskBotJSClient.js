import * as React from "react";

import axios from "axios";

export const { Provider, Consumer } = React.createContext(null);

export function create(baseUrl) {
  return axios.create({
    baseURL: baseUrl
  });
}

export function withClient(ComponentType) {
  return class extends React.Component {
    static get name() { return `TaskBotJSClient(${ComponentType.name})`; }

    render() {
      return (
        <React.Fragment>
          <Consumer>
            {
              value => <ComponentType client={value} {...this.props} />
            }
          </Consumer>
        </React.Fragment>
      );
    }
  }
}
