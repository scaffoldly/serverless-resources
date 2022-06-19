"use strict";

class ServerlessResources {
  constructor(serverless) {
    this.serverless = serverless;
    this.hooks = {
      initialize: () => this.init(),
    };
  }

  init() {
    console.log("Serverless instance: ", this.serverless);

    // `serverless.service` contains the (resolved) serverless.yml config
    const service = this.serverless.service;
    console.log("Provider name: ", service.provider.name);
    console.log("Functions: ", service.functions);
  }
}

module.exports = ServerlessResources;
