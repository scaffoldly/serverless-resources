'use strict';

const { createHash } = require('crypto');

const normalize = (_, value) =>
  value instanceof Object && !(value instanceof Array)
    ? Object.keys(value)
        .sort()
        .reduce((sorted, key) => {
          sorted[key] = value[key];
          return sorted;
        }, {})
    : value;

class ServerlessResources {
  constructor(serverless, options, { log }) {
    this.serverless = serverless;
    this.options = options;
    this.log = log;
    this.hooks = {
      initialize: async () => this.init(),
    };
  }

  assert() {
    if (!this.serverless) {
      throw new Error('serverless is unset');
    }

    if (!this.serverless.providers || !this.serverless.providers.aws) {
      throw new Error('only the AWS provider is supported at this time');
    }

    if (
      !this.serverless.configurationInput.resources ||
      !this.serverless.configurationInput.resources.Resources ||
      !Object.keys(this.serverless.configurationInput.resources.Resources).length
    ) {
      throw new Error('no resources are defined in serverless.yml');
    }

    const { plugins } = this.serverless.pluginManager;
    const serverlessOffline = plugins.find(
      (p) => p.__proto__.constructor.name === 'ServerlessOffline',
    );
    const localstack = plugins.find((p) => p.__proto__.constructor.name === 'LocalstackPlugin');

    if (!serverlessOffline) {
      throw new Error('serverless-offline plugin is not installed');
    }

    if (!localstack) {
      throw new Error('serverless-localstack plugin is not installed');
    }
  }

  async init() {
    try {
      this.assert();
    } catch (e) {
      console.warn(`[serverless-resources] Skipping: ${e.message}`);
      return;
    }

    // TODO: Support other providers
    const provider = this.serverless.getProvider('aws');

    const region = provider.options.region || provider.region || 'us-east-1';

    const template = this.serverless.configurationInput.resources;

    const client = new provider.sdk.CloudFormation({ region });

    const stackName = `${provider.naming.getStackName()}-resources`;

    await this.upsertStack(client, stackName, template);
  }

  async upsertStack(client, stackName, template) {
    const templateSha = createHash('sha256')
      .update(JSON.stringify(template, normalize))
      .digest('hex')
      .toString();

    console.log(`[serverless-resources] SHA: ${templateSha}`);

    const parameters = [
      {
        ParameterKey: 'TemplateSHA',
        ParameterValue: templateSha,
      },
    ];

    try {
      await client
        .createStack({
          StackName: stackName,
          Parameters: parameters,
          TemplateBody: JSON.stringify(template),
        })
        .promise();
      console.log(`[serverless-resources] Created stack: ${stackName}`);
      await this.pollForStatus(client, stackName, ['_COMPLETE', '_FAILED']);
      return;
    } catch (e) {
      if (e.code !== 'ValidationError') {
        throw e;
      }
    }

    const { Stacks } = await client.describeStacks({ StackName: stackName }).promise();
    if (!Stacks || !Stacks.length) {
      throw new Error(`Unknown stack: ${stackName}`);
    }

    const [stack] = Stacks;

    const shaParameter = stack.Parameters.find((t) => t.ParameterKey === 'TemplateSHA');

    if (shaParameter && shaParameter.ParameterValue === templateSha) {
      console.log(`[serverless-resources] Skipping: There no changes`);
      return;
    }

    console.log(`[serverless-resources] Updating resources: ${Object.keys(template.Resources)}`);

    await client
      .updateStack({
        StackName: stackName,
        Parameters: parameters,
        TemplateBody: JSON.stringify(template),
      })
      .promise();

    await this.pollForStatus(client, stackName, ['_COMPLETE', '_FAILED']);
  }

  // TODO switch to regex matching
  async pollForStatus(client, stackName, statuses = ['_COMPLETE', '_FAILED']) {
    const { Stacks } = await client.describeStacks({ StackName: stackName }).promise();
    if (!Stacks || !Stacks.length) {
      throw new Error(`Unknown stack: ${stackName}`);
    }
    const [stack] = Stacks;

    if (statuses.some((s) => stack.StackStatus.indexOf(s) !== -1)) {
      console.log(`[serverless-resources] Stack ${stackName} is ${stack.StackStatus}`);
      return;
    }

    return new Promise((resolve) => {
      console.log(`[serverless-resources] Stack ${stackName} is ${stack.StackStatus}`);
      setTimeout(() => {
        this.pollForStatus(client, stackName, statuses).then(() => resolve());
      }, 1000);
    });
  }
}

module.exports = ServerlessResources;
