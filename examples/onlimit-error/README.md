# GraphQL Rate Limit - Throw error onLimit

This example illustrates a custom error raised on rate limit exceeded.

## Overview

Specify a `onLimit` function. Throws a `RateLimitError` with contextual information.

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

Server is configured to allow each root field to be queried once every 15 seconds.

Sample query:

```graphql
{
  quote
  books {
    title
    author
  }
}
```

Sample rate limited response:

```json
{
  "errors": [
    {
      "message": "Too many requests, please try again shortly.",
      "locations": [
        {
          "line": 7,
          "column": 3
        }
      ],
      "path": [
        "quote"
      ],
      "extensions": {
        "code": "RATE_LIMITED",
        "resetAt": "2019-02-03T19:34:16.164Z"
      }
    },
    {
      "message": "Too many requests, please try again shortly.",
      "locations": [
        {
          "line": 8,
          "column": 3
        }
      ],
      "path": [
        "books"
      ],
      "extensions": {
        "code": "RATE_LIMITED",
        "resetAt": "2019-02-03T19:34:16.163Z"
      }
    }
  ],
  "data": {
    "quote": null,
    "books": null
  }
}
```
