const { makeExecutableSchema } = require('@graphql-tools/schema');
const express = require('express');
const { graphqlHTTP } = require('express-graphql');
const { rateLimitDirective } = require('graphql-rate-limit-directive');
const { RateLimiterMemory } = require('rate-limiter-flexible');

// This is not necessary, it exists to demonstrate when we check the rate limit usage
class DebugRateLimiterMemory extends RateLimiterMemory {
  consume(key, pointsToConsume, options) {
    console.log(`[CONSUME] ${key} for ${pointsToConsume}`);
    return super.consume(key, pointsToConsume, options);
  }
}

class RateLimitError extends Error {
  constructor(msBeforeNextReset) {
    super('Too many requests, please try again shortly.');

    // Determine when the rate limit will be reset so the client can try again
    const resetAt = new Date();
    resetAt.setTime(resetAt.getTime() + msBeforeNextReset);

    // GraphQL will automatically use this field to return extensions data in the GraphQLError
    // See https://github.com/graphql/graphql-js/pull/928
    this.extensions = {
      code: 'RATE_LIMITED',
      resetAt,
    };
  }
}

// IMPORTANT: Specify how a rate limited field should behave when a limit has been exceeded
const onLimit = (resource, directiveArgs, source, args, context, info) => {
  throw new RateLimitError(resource.msBeforeNext);
};

const { rateLimitDirectiveTypeDefs, rateLimitDirectiveTransformer } = rateLimitDirective({
  onLimit,
  limiterClass: DebugRateLimiterMemory
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
# Repeated requests within this time window will raise a custom error.

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
