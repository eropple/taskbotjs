# `@jsjobs/webui` #

## Development ##
You'll need to run a copy of `@jsjobs/panel` to provide this project with its
backing API. Ordinarily, `@jsjobs/panel` will host a built copy of the webui; if
you start the server with `dev.config.js`, the panel won't host its own copy of
webui.

If you need to create your own panel configuration for dev (though I don't know
why that'd be the case during development), you can do so by setting
`Config.hostWebUI` to `false`.

Then, before running webui in development mode (as you would any other
`create-react-app` app), copy `dev.config.json` to `public/config.json` in order
to point at the API hosted by `@jsjobs/panel`.
