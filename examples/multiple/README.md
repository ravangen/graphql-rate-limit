# GraphQL Rate Limit - Multiple Limits

This example illustrates applying multiple rate limits on the same field.

## Overview

Multiple limits can be used if you want to impose both burst throttling rates, and sustained throttling rates. For example, you might want to limit a user to a maximum of 60 requests per minute, and 1000 requests per day.

Multiple schema directives can be created using different names and assigned to the same location.

### Unique Directives

As of the June 2018 version of the GraphQL specification, [Directives Are Unique Per Location](https://facebook.github.io/graphql/June2018/#sec-Directives-Are-Unique-Per-Location). A spec [RFC to "Limit directive uniqueness to explicitly marked directives"](https://github.com/facebook/graphql/pull/472) is currently at [Stage 2: Draft](https://github.com/facebook/graphql/blob/master/CONTRIBUTING.md#stage-2-draft). As a result, multiple `@rateLimit` directives can not be defined on the same location. Instead we create multiple directives with different names.

## Setup

#### Step 1: Install requirements

```bash
yarn install
```

## Run

#### Step 1: Start server

```bash
node index.js
```

#### Step 2: Open Playground

Navigate to [`http://localhost:4000/`](http://localhost:4000/) in a browser.

#### Step 3: Execute GraphQL operations

Server is configured to allow `books` to be queried once every 15 seconds and three times every 60 seconds. Sample query:

```graphql
{
  books {
    title
  }
}
```
