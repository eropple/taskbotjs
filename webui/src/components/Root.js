import * as React from "react";
import CssBaseline from "@material-ui/core/CssBaseline";

import ThemeProvider from "./ThemeProvider";
import * as Bootstrap from "./Bootstrap";
import Main from "./Main";

export default class Root extends React.Component {
  render() {
    return (
      <CssBaseline>
        <ThemeProvider>
          <Bootstrap.Element>
            {
              () => <Main />
            }
          </Bootstrap.Element>
        </ThemeProvider>
      </CssBaseline>
    );
  }
}
