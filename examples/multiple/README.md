# GraphQL Rate Limit - Multiple Limits

This example illustrates applying multiple rate limits on the same field.

## Overview

Multiple limits can be used if you want to impose both burst throttling rates, and sustained throttling rates. For example, you might want to limit a user to a maximum of 60 requests per minute, and 1000 requests per day.

Multiple schema directives can be created using different names and assigned to the same location.

### Unique Directives

As of the June 2018 version of the GraphQL specification, [Directives Are Unique Per Location](http://spec.graphql.org/June2018/#sec-Directives-Are-Unique-Per-Location). In newer versions of the spec, being unique per location is no longer required. However, this library continues to assume there not multiple rate limit directives with the same name on the same field.

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

#### Step 2: Open GraphiQL

Navigate to [`http://localhost:4000/graphql`](http://localhost:4000/graphql) in a browser.

#### Step 3: Execute GraphQL operations

Server is configured to allow each root field to be queried once every 15 seconds and three times every 60 seconds. Sample query:

```graphql
{
  quote
  books {
    title
    author
  }
}
```
