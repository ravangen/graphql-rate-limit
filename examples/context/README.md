# GraphQL Rate Limit - User Context

This example illustrates isolating operations between users. Commonly used in a multi user environment.

## Overview

Specify a `keyGenerator` function which uses contextual information from the resolver's `context`.

In this example, a user is identified by the IP address of the request.

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

Server is configured to allow each root field to be queried once every 15 seconds. Sample query:

```graphql
{
  quote
  books {
    title
    author
  }
}
```
