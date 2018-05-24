import * as React from "react";

import Paper from "@material-ui/core/Paper";
import Typography from "@material-ui/core/Typography";

export default class DevNote extends React.Component {
  render() {
    return (
      <Paper style={{ padding: "1rem", marginBottom: "2rem" }}>
        <Typography variant="headline">
          Developer's Note
        </Typography>
        <Typography paragraph variant="body1">
          Hey there, and thanks for trying out--or even using in production--TaskBotJS.
          You'll probably notice that this web panel is a little bit WIP; while I've
          spent a lot of time on TaskBotJS and making sure the core service is awesome,
          this control panel is a weekend project added to facilitate exploring your
          jobs outside of a programming context.
        </Typography>
        <Typography paragraph variant="body1">
          Over time, I'll refine the control panel to make it more user-friendly. At
          the moment our happy paths work, but error handling is not surfaced to you
          (so you might want to run the control panel with your JavaScript console
          open) and it's light on documentation. Also, TaskBotJS Pro and TaskBotJS
          Enterprise come with extended versions of the control panel to encompass
          their expanded feature sets.
        </Typography>
        <Typography paragraph variant="body1">
          I'm very interested in how you feel about TaskBotJS and how I can make both
          the service itself and the control panel more useful for you. Please feel
          free to <a href="https://github.com/eropple/taskbotjs/issues" target="_blank"
          rel="noopener noreferrer"> file a GitHub issue</a> or contact me directly
          via email or Twitter.
        </Typography>
        <Typography paragraph variant="body1" style={{ textAlign: "right" }}>
          Ed Ropple<br />
          <a href="mailto:ed+taskbotjs@edboxes.com">ed+taskbotjs@edboxes.com</a><br />
          <a href="https://twitter.com/edropple" target="_blank"
          rel="noopener noreferrer">@edropple</a> on Twitter
        </Typography>
      </Paper>
    );
  }
}
