import * as React from "react";
import {
  MuiThemeProvider,
  createMuiTheme
} from '@material-ui/core/styles';

import red from "@material-ui/core/colors/red";

const theme = createMuiTheme({
  palette: {
    type: "light",
    primary: {
      main: "#b3e5fc",
      light: "#e6ffff",
      dark: "#82b3c9"
    },
    secondary: {
      main: "#b9f6ca",
      light: "#ecfffd",
      dark: "#88c399"
    },
    error: red
  },
});

export default class ThemeProvider extends React.Component {
  render() {
    return (
      <React.Fragment>
        <MuiThemeProvider theme={theme}>
          {this.props.children}
        </MuiThemeProvider>
      </React.Fragment>
    );
  }
}
