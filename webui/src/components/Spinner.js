import * as React from "react";
import * as Spinkit from "better-react-spinkit";

export default class Spinner extends React.Component {
  render() {
    return (
      <div style={{ margin: "1em auto" }}>
        <Spinkit.WanderingCubes />
      </div>
    );
  }
}
