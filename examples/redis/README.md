# GraphQL Rate Limit - Redis store

This example illustrates using Redis as a data store. Commonly used to share state in a distrubuted environment.

## Overview

Use [`RateLimiterRedis`](https://github.com/animir/node-rate-limiter-flexible/wiki/Redis) along with a [`redis`](https://www.npmjs.com/package/redis#options-object-properties) or [`ioredis`](https://www.npmjs.com/package/ioredis) client.

## Setup

A Redis server is required and the GraphQL server needs to know how to connect to it.

### Redis Server

#### Option 1: Free Cloud Hosted

Use [Redis Labs'](https://redislabs.com/) free subscription for a small cloud hosted Redis database. See [Creating a Subscription](https://docs.redislabs.com/latest/rc/administration/setup-and-editing/create-subscription/).

#### Option 2: Manually

Download, install, and configure [Redis](https://redis.io/).

### GraphQL Server

This example requires a `url` and `password` to a Redis database.

#### Step 1: Install requirements

```bash
yarn install
```

#### Step 2: Create a `.env` file

```bash
cp .env.sample .env
```

#### Step 3: Set environment variables

In `.env` file, set `REDIS_URL` and `REDIS_PASSWORD`. These values are used on server startup.

Example `.env` content:

```
REDIS_URL=redis://redis-12345.c14.us-east-1-2.ec2.cloud.redislabs.com:12345
REDIS_PASSWORD=MySecretString
```

## Run

#### Step 1: Start server

```bash
node index.js
```

#### Step 2: Open Playground

Navigate to [`http://localhost:4000/`](http://localhost:4000/) in a browser.

#### Step 3: Execute GraphQL operations

Server is configured to allow each field to be queried once every 15 seconds. Sample query:

```graphql
{
  quote
  books {
    title
  }
}
```
