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
