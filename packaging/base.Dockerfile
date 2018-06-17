FROM node:8
ENV NODE_ENV production
ENV TASKBOT_REDIS_URL redis://redis:6379

# Uploading all artifacts
RUN mkdir /artifacts
COPY _artifacts/* /artifacts/

# Linking each artifact to get around Yarn dependency management
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
