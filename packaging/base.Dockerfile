FROM node:8
ENV NODE_ENV production
ENV TASKBOT_REDIS_URL redis://redis:6379
ENV TASKBOT_PANEL_EXTERNAL_HTTP http://localhost:19982

# Uploading all artifacts
RUN mkdir /artifacts
COPY _artifacts/* /artifacts/

# Don't be scared; this is more complicated/stupid than an actual deploy is
# going to have to be. I've written this before putting these artifacts on NPM,
# and so both NPM and Yarn _hate me_ for it. Yarn, even when things are `yarn
# link`ed, checks the registry and gets mad at you for not having published the
# package yet. NPM's issues are not dissimilar. So this gets around it by using
# npm link to satisfy the package dependencies exactly so far as to copy a full
# version of the artifact into the global node_modules.
#
# You should have a much easier time of it than I did.
WORKDIR /artifacts
RUN tar xzf client.tgz
RUN mv package client
WORKDIR /artifacts/client
RUN npm install
RUN npm link
RUN npm install -g /artifacts/client

WORKDIR /artifacts
RUN tar xzf service.tgz
RUN mv package service
WORKDIR /artifacts/service
RUN npm link @taskbotjs/client
RUN npm install
RUN npm link
RUN npm install -g /artifacts/service

WORKDIR /artifacts
RUN tar xzf webapi.tgz
RUN mv package webapi
WORKDIR /artifacts/webapi
RUN npm link @taskbotjs/client
RUN npm install
RUN npm link
RUN npm install -g /artifacts/webapi

WORKDIR /artifacts
RUN tar xzf panel.tgz
RUN mv package panel
WORKDIR /artifacts/panel
RUN npm link @taskbotjs/client
RUN npm link @taskbotjs/webapi
RUN npm install
RUN npm link
RUN npm install -g /artifacts/panel

WORKDIR /artifacts
RUN tar xzf example.tgz
RUN mv package example
WORKDIR /artifacts/example
RUN npm link @taskbotjs/client
RUN npm link @taskbotjs/service
RUN npm install
RUN npm link
RUN npm install -g /artifacts/example
