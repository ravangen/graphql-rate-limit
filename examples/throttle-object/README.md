# GraphQL Rate Limit - Object from Throttle

This example illustrates returning a different object instead of normal object type resolution on rate limit exceeded.

## Overview

Inspired by [Where art thou, my error?](http://artsy.github.io/blog/2018/10/19/where-art-thou-my-error/), an Artsy Engineering Blog post, we can give exceptions their own type and return those instead of the success type, when they occur. The `throttle` function returns a `RateLimit` object with contextual information and that is part of the query's data in a union type.

**WARNING:** This approach only works on object types (not scalar types). See [Proposal: Support union scalar types](https://github.com/facebook/graphql/issues/215).

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

Server is configured to allow each field to be queried once every 15 seconds.

Sample query:

```graphql
{
  favouriteBook {
    __typename
    ... on Book {
      title
    }
    ... on RateLimit {
      limit
      resetAt
    }
  }
}
```

Sample rate limited response:

```json
{
  "data": {
    "favouriteBook": {
      "__typename": "RateLimit",
      "limit": 1,
      "resetAt": "2019-02-05T04:58:48.238Z"
    }
  }
}
```
