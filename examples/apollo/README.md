# GraphQL Rate Limit - Apollo Server

This example illustrates using Apollo Server 4.

## Overview

## Setup

#### Step 1: Install requirements

```bash
npm install
```

## Run

#### Step 1: Start server

```bash
npm start
```

#### Step 2: Open GraphiQL

Navigate to [`http://localhost:4000`](http://localhost:4000) in a browser.

#### Step 3: Execute GraphQL operations

Server is configured to allow each root field to be queried twice every 10 seconds. Sample query:

```graphql
query ExampleQuery {
  books {
    title
  }
}
```

For each rate limiter hit, terminal outputs usage:

```
[CONSUME] Query.books for 1
```
