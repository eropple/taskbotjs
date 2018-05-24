import * as React from "react";

import * as TaskBotJSClient from "./TaskBotJSClient";
import Spinner from "./Spinner";

export const { Provider, Consumer } = React.createContext(null);

/**
 * Fetches /config.json from the server and injects it into the React context.
 * Once complete, it
 */
export class Element extends React.Component {
  static DEFAULT_STATE = { bootstrap: null, error: null };

  constructor(props) {
    super(props);

    this.state = Element.DEFAULT_STATE;
  }

  componentWillMount() {
    (async () => {
      try {
        const resp = await fetch("/config.json");

        if (resp.status !== 200) {
          throw new Error("Failed to fetch bootstrap.");
        }

        const bootstrap = await resp.json();
        const apiClient = TaskBotJSClient.create(bootstrap.apiBase);

        this.setState({ bootstrap, apiClient });
      } catch (err) {
        this.setState({ error: err.message });
      }
    })();
  }

  render() {
    const { props, state } = this;

    return (
      state.error
        ? <div>{state.error}</div>
        : state.bootstrap && state.apiClient
            ? <Provider value={state.bootstrap}>
                <TaskBotJSClient.Provider value={state.apiClient}>
                  {props.children()}
                </TaskBotJSClient.Provider>
              </Provider>
            : <Spinner />
    );
  }
}

export function withBootstrap(ComponentType) {
  return class extends React.Component {
    static get name() { return `Bootstrap(${ComponentType.name})`; }

    render() {
      return (
        <React.Fragment>
          <Consumer>
            {
              value => <ComponentType bootstrap={value} {...this.props} />
            }
          </Consumer>
        </React.Fragment>
      );
    }
  }
}
