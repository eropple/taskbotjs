import * as React from "react";
import {
  Link
} from "react-router-dom";

import AppBar from "@material-ui/core/AppBar";
import Toolbar from "@material-ui/core/Toolbar";
import Typography from "@material-ui/core/Typography";

import { withBootstrap } from "./Bootstrap";
import { withClient } from "./TaskBotJSClient";

export class Bar extends React.Component {
  render() {
    return (
      <React.Fragment>
        <AppBar position="static">
          <Toolbar>
            <Typography
                variant="title"
                color="default">
              <Link to="/" style={{ textDecoration: "none" }}>
                TaskBotJS (WIP!)
              </Link>
            </Typography>
          </Toolbar>
        </AppBar>
      </React.Fragment>
    );
  }
}

export default withBootstrap(withClient(Bar));
