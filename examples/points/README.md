# GraphQL Rate Limit - Points Calculator

This example illustrates customizing how many points are consumed in different resolver situations.

## Overview

Specify a `pointsCalculator` function which uses contextual information from the resolver's `info` and `context`.

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

Server is configured to allow the following queries:

- `quote`: 10 times every 30 seconds (due to `defaultPointsCalculator`)
- `books`: 5 times every 30 seconds (due to cost of `2`) or unlimited times when the GraphQL API endpoint includes query string `token=secret` (**within** Playground, change the URL to `http://localhost:4000/?token=secret`)

Sample query:

```graphql
{
  quote
  books {
    title
  }
}
```
