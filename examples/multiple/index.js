const { makeExecutableSchema } = require('@graphql-tools/schema');
const express = require('express');
const { graphqlHTTP } = require('express-graphql');
const { rateLimitDirective } = require('graphql-rate-limit-directive');
const { RateLimiterMemory } = require('rate-limiter-flexible');

// This is not necessary, it exists to demonstrate when we check the rate limit usage
class DebugBurstRateLimiterMemory extends RateLimiterMemory {
  consume(key, pointsToConsume, options) {
    console.log(`[BURST][CONSUME] ${key} for ${pointsToConsume}`);
    return super.consume(key, pointsToConsume, options);
  }
}
class DebugSustainedRateLimiterMemory extends RateLimiterMemory {
  consume(key, pointsToConsume, options) {
    console.log(`[SUSTAINED][CONSUME] ${key} for ${pointsToConsume}`);
    return super.consume(key, pointsToConsume, options);
  }
}

const {
  rateLimitDirectiveTypeDefs: burstRateLimitDirectiveTypeDefs,
  rateLimitDirectiveTransformer: burstRateLimitDirectiveTransformer,
} = rateLimitDirective({
  name: 'burstRateLimit',
  limiterClass: DebugBurstRateLimiterMemory
});
const {
  rateLimitDirectiveTypeDefs: sustainedRateLimitDirectiveTypeDefs,
  rateLimitDirectiveTransformer: sustainedRateLimitDirectiveTransformer,
} = rateLimitDirective({
  name: 'sustainedRateLimit',
  limiterClass: DebugSustainedRateLimiterMemory
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
    // IMPORTANT: Include directive type definitions for both @burstRateLimit and @sustainedRateLimit
    burstRateLimitDirectiveTypeDefs,
    sustainedRateLimitDirectiveTypeDefs,
    `# Allow each field to be queried once every 15 seconds and three times every 60 seconds
    type Query @burstRateLimit(limit: 1, duration: 15) @sustainedRateLimit(limit: 3, duration: 60) {
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
// IMPORTANT: Rate limits are evaluated from last transform to first (the sustained directive is wrapped by the burst directive)
schema = sustainedRateLimitDirectiveTransformer(schema);
schema = burstRateLimitDirectiveTransformer(schema);

const app = express();
app.use(
  '/graphql',
  graphqlHTTP((request) => {
    return {
      schema,
      graphiql: {
        defaultQuery: `# Welcome to GraphiQL
#
# Allow each field to be queried once every 15 seconds and three times every 60 seconds.
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
