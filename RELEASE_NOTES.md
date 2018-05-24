# Release Notes #
**Please note:** Don't let the version scare you off. TaskBotJS is at version 0.1.0
not due to incompleteness, but rather because I don't want to make the firm
guarantees that a "1.0" version implies without strong guarantees about the
software as a whole, including documentation and examples. I consider TaskBotJS to
be production-ready, I have used it in production, and if there are any problems
as new users test TaskBotJS in ways I haven't, I'll be responsive to those issues
on [GitHub].

## 0.1.0 ##
**Initial software release!**

- Performs immediate jobs through `perform_async`.
- Schedules jobs for later execution through `perform_at`.
- Takes jobs from multiple queues, which can be weighted for preferential
  treatment.
- Jobs can retry on failure, with per-job configurable retry strategies.
- Lifecycle events for major events, such as a job failing.
- Provides high-level cluster-wide metrics.
- A starting point for the web UI, written in React and Express.
- **Pro:** provides more granular, per-worker metrics.
- **Pro:** expiring jobs: "if this job hasn't executed by this time, don't run
  it."
- **Pro:** reliable queueing: should TaskBotJS shut down gracelessly due to an
  error, jobs will be detected as orphaned and returned to the job queue.
- **Pro:** batching and orchestration: develop a dependency tree for a set of
  jobs and execute them only when dependencies have been satisfied.

[GitHub]: https://github.com/eropple/taskbotjs/issues
