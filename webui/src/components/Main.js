import * as React from "react";
import {
  BrowserRouter as Router,
  Route,
  Switch,
  Redirect
} from "react-router-dom"
import Grid from "@material-ui/core/Grid";

import * as qs from "qs";

import Bar from "./Bar";
import * as TaskBotJSClient from "./TaskBotJSClient";
import Ticker from "./Ticker";

import Dashboard from "./Dashboard";
import NotFound from "./NotFound";

import QueueExplorer from "./QueueExplorer";
import QueueJob from "./QueueExplorer/QueueJob";

import SetExplorer from "./SetExplorer";
import SetJob from "./SetExplorer/SetJob";

export class Main extends React.Component {
  render() {
    return (
      <div style={{ flexGrow: 1 }}>
        <Router>
          <Grid container spacing={16}>
            <Bar />
            <Ticker>
              {
                () =>
                  <Grid item xs={12} style={{ marginTop: "2rem", padding: "0 2rem" }}>
                    <Switch>
                      <Route exact path="/" component={Dashboard} />
                      <Route exact path="/queues/:queueName" render={
                        (route) => <Redirect to={`/queues/${route.match.params.queueName}/page/1`} />
                      } />
                      <Route exact path="/queues/:queueName/page/:pageNumber" render={
                        (route) => {
                          const { queueName, pageNumber } = route.match.params;

                          return <QueueExplorer queueName={queueName} pageNumber={parseInt(pageNumber, 10)} />;
                        }
                      } />
                      <Route exact path="/queues/:queueName/jobs/:jobId" render={
                        (route) => {
                          const { queueName, jobId } = route.match.params;
                          const queryParams = qs.parse(route.location.search.substr(1));
                          let { pageHint } = queryParams;

                          if (pageHint) {
                            pageHint = parseInt(pageHint, 10);
                          }

                          return <QueueJob queueName={queueName} jobId={jobId} pageHint={pageHint} />;
                        }
                      } />
                      <Route exact path="/retry" render={
                        (route) => <Redirect to={"/retry/page/1"} />
                      } />
                      <Route exact path="/retry/page/:pageNumber" render={
                        (route) => {
                          const { pageNumber } = route.match.params;

                          return <SetExplorer setName="retry" pageNumber={parseInt(pageNumber, 10)} />;
                        }
                      } />
                      <Route exact path="/retry/jobs/:jobId" render={
                        (route) => {
                          const { jobId } = route.match.params;
                          const queryParams = qs.parse(route.location.search.substr(1));
                          let { pageHint } = queryParams;

                          if (pageHint) {
                            pageHint = parseInt(pageHint, 10);
                          }

                          return <SetJob setName="retry" jobId={jobId} pageHint={pageHint} />;
                        }
                      } />

                      <Route exact path="/scheduled" render={
                        (route) => <Redirect to={"/scheduled/page/1"} />
                      } />
                      <Route exact path="/scheduled/page/:pageNumber" render={
                        (route) => {
                          const { pageNumber } = route.match.params;

                          return <SetExplorer setName="scheduled" pageNumber={parseInt(pageNumber, 10)} />;
                        }
                      } />
                      <Route exact path="/scheduled/jobs/:jobId" render={
                        (route) => {
                          const { jobId } = route.match.params;
                          const queryParams = qs.parse(route.location.search.substr(1));
                          let { pageHint } = queryParams;

                          if (pageHint) {
                            pageHint = parseInt(pageHint, 10);
                          }

                          return <SetJob setName="scheduled" jobId={jobId} pageHint={pageHint} />;
                        }
                      } />

                      <Route exact path="/dead" render={
                        (route) => <Redirect to={"/dead/page/1"} />
                      } />
                      <Route exact path="/dead/page/:pageNumber" render={
                        (route) => {
                          const { pageNumber } = route.match.params;

                          return <SetExplorer setName="dead" pageNumber={parseInt(pageNumber, 10)} />;
                        }
                      } />
                      <Route exact path="/dead/jobs/:jobId" render={
                        (route) => {
                          const { jobId } = route.match.params;
                          const queryParams = qs.parse(route.location.search.substr(1));
                          let { pageHint } = queryParams;

                          if (pageHint) {
                            pageHint = parseInt(pageHint, 10);
                          }

                          return <SetJob setName="dead" jobId={jobId} pageHint={pageHint} />;
                        }
                      } />
                      <Route component={NotFound} />
                    </Switch>
                  </Grid>
              }
            </Ticker>
          </Grid>
        </Router>
      </div>
    )
  }
}

export default TaskBotJSClient.withClient(Main);
