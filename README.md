# Serverless Resources

The `serverless-resources` plugin allows the Serverless Framework to create cloud resources
defined in the `resources` section of `serverless.yml`.

_Note_: this plugin only works when `serverless offline` is the command to avoid conflicts with the
stack resources created by `serverless deploy`.

## Install/Configure

Install the package:

```
yarn add --dev serverless-resources
```

`serverless.yml`:

```
plugins:
 ...
 - serverless-resources
 - serverless-offline
```

(_Note_: This plugin must be before `serverless-offline`)

### Localstack support

This plugin also supports `serverless-localstack` so Cloud Resources can be created when running
in conjunction with `serverless-offline`:

`serverless.yml`:

```
plugins:
 ...
 - serverless-localstack
 - serverless-resources
 ...
 - serverless-offline
```

(_Note_: This plugin must be before `serverless-offline`, and after `serverless-localstack`)

## Configuration Options

`serverless.yml`:

```
custom:
  serverless-resources:
    stages:              # A list of stages to run this plugin, defaults to ['dev']
      - dev
```

## Roadmap

- Better collaboration with the generated CloudFormation template from Serverless
  - Need to find the right way to generate it during lifecycle events
- Support Additional Cloud Providers
- Add CLI Commands to Create/Delete/etc
