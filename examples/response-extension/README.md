# GraphQL Rate Limit - Response Extension

This example illustrates returning the current rate limit information as an extension in the response.

## Overview

Instruct the directive to store the latest schema member rate limit information in context by providing a `getState` function.

Format the respone's `extensions` with rate limit information stored in `context`.

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

Server is configured to allow each root field to be queried three times every 15 seconds. Sample query:

```graphql
{
  quote
  books {
    title
    author
  }
}
```

Example response:

```json
{
  "data": {
    "quote": "The future is something which everyone reaches at the rate of sixty minutes an hour, whatever he does, whoever he is. ― C.S. Lewis",
    "books": [
      {
        "title": "A Game of Thrones"
      },
      {
        "title": "The Hobbit"
      }
    ]
  },
  "extensions": {
    "rateLimit": {
      "Query.quote": {
        "remaining": 2,
        "consumed": 1,
        "resets": 15
      },
      "Query.books": {
        "remaining": 2,
        "consumed": 1,
        "resets": 15
      }
    }
  }
}
```
