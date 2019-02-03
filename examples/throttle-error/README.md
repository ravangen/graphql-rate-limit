# GraphQL Rate Limit - Error from Throttle

This example illustrates a custom error raised on rate limit exceeded.

## Overview

Specify a `throttle` function. Throws a `RateLimitError` with contextual information.

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
  quote
  books {
    title
  }
}
```

Sample rate limited response:

```json
{
  "errors": [
    {
      "message": "Too many requests, please try again shortly",
      "locations": [
        {
          "line": 2,
          "column": 3
        }
      ],
      "path": ["quote"],
      "extensions": {
        "code": "RATE_LIMITED",
        "resetAt": "2019-02-03T19:34:16.164Z",
        "exception": {
          "stacktrace": [
            "Error: Too many requests, please try again shortly.",
            "    at throttle (/Users/user/graphql-rate-limit/examples/throttle-error/index.js:57:9)",
            "    at Object.<anonymous> (/Users/user/graphql-rate-limit/examples/throttle-error/node_modules/graphql-rate-limit-directive/dist/index.js:106:28)",
            "    at Generator.throw (<anonymous>)",
            "    at rejected (/Users/user/graphql-rate-limit/examples/throttle-error/node_modules/graphql-rate-limit-directive/dist/index.js:5:65)",
            "    at process._tickCallback (internal/process/next_tick.js:68:7)"
          ]
        }
      }
    },
    {
      "message": "Too many requests, please try again shortly.",
      "locations": [
        {
          "line": 3,
          "column": 3
        }
      ],
      "path": ["books"],
      "extensions": {
        "code": "RATE_LIMITED",
        "resetAt": "2019-02-03T19:34:16.163Z",
        "exception": {
          "stacktrace": [
            "Error: Too many requests, please try again shortly",
            "    at throttle (/Users/user/graphql-rate-limit/examples/throttle-error/index.js:57:9)",
            "    at Object.<anonymous> (/Users/user/graphql-rate-limit/examples/throttle-error/node_modules/graphql-rate-limit-directive/dist/index.js:106:28)",
            "    at Generator.throw (<anonymous>)",
            "    at rejected (/Users/user/graphql-rate-limit/examples/throttle-error/node_modules/graphql-rate-limit-directive/dist/index.js:5:65)",
            "    at process._tickCallback (internal/process/next_tick.js:68:7)"
          ]
        }
      }
    }
  ],
  "data": {
    "quote": null,
    "books": null
  }
}
```
