require('dotenv').config();
const { makeExecutableSchema } = require('@graphql-tools/schema');
const express = require('express');
const { graphqlHTTP } = require('express-graphql');
const { rateLimitDirective } = require('graphql-rate-limit-directive');
const { RateLimiterRedis } = require('rate-limiter-flexible');
const redis = require('redis');

// This is not necessary, it exists to demonstrate when we check the rate limit usage
class DebugRateLimiterRedis extends RateLimiterRedis {
  consume(key, pointsToConsume, options) {
    console.log(`[CONSUME] ${key} for ${pointsToConsume}`);
    return super.consume(key, pointsToConsume, options);
  }
}

// IMPORTANT: Create a client to provide into rateLimitDirective options
const redisClient = redis.createClient({
  url: process.env.REDIS_URL,
  password: process.env.REDIS_PASSWORD,
  enable_offline_queue: false, // must be created with offline queue switched off
});
redisClient.on('ready', () => {
  console.log('[REDIS] Connection established')
});
redisClient.on('end', () => {
  console.log('[REDIS] Connection closed')
});
redisClient.on('error', error => {
  console.log(error);
});

const { rateLimitDirectiveTypeDefs, rateLimitDirectiveTransformer } = rateLimitDirective({
  // IMPORTANT: Tell the directive's limiter to use RateLimiterRedis along with specific options
  limiterClass: DebugRateLimiterRedis,
  limiterOptions: {
    storeClient: redisClient,
  },
});

const resolvers = {
  Query: {
    books: () => [
      {
        title: 'A Game of Thrones',
        author: 'George R. R. Martin',
      },
      {
        title: 'The Hobbit',
        author: 'J. R. R. Tolkien',
      },
    ],
    quote: () =>
      'The future is something which everyone reaches at the rate of sixty minutes an hour, whatever he does, whoever he is. ― C.S. Lewis',
  },
};
let schema = makeExecutableSchema({
  typeDefs: [
    rateLimitDirectiveTypeDefs,
    `# Allow each field to be queried once every 15 seconds
    type Query @rateLimit(limit: 1, duration: 15) {
      books: [Book!]
      quote: String
    }

    type Book {
      title: String
      author: String
    }`,
  ],
  resolvers,
});
schema = rateLimitDirectiveTransformer(schema);

const app = express();
app.use(
  '/graphql',
  graphqlHTTP((request) => {
    return {
      schema,
      graphiql: {
        defaultQuery: `# Welcome to GraphiQL
#
# Allow each field to be queried once every 15 seconds.
# Repeated requests within this time window will fail.

query {
  quote
  books {
    title
    author
  }
}`
      },
    };
  }),
);
app.listen(4000, () => {
  console.log(`🚀  Server ready at http://localhost:4000/graphql`);
});
