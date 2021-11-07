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

class RateLimit {
  constructor(limit, msBeforeNextReset) {
    // Determine when the rate limit will be reset so the client can try again
    const resetAt = new Date();
    resetAt.setTime(resetAt.getTime() + msBeforeNextReset);

    this.limit = limit;
    this.resetAt = resetAt.toISOString();
  }
}

// IMPORTANT: Specify how a rate limited field should behave when a limit has been exceeded
const onLimit = (resource, directiveArgs, source, args, context, info) =>
  new RateLimit(directiveArgs.limit, resource.msBeforeNext);

const { rateLimitDirectiveTypeDefs, rateLimitDirectiveTransformer } = rateLimitDirective({
  onLimit,
  limiterClass: DebugRateLimiterMemory
});

const resolvers = {
  Query: {
    favouriteBook: () => ({
      title: 'The Hobbit',
      author: 'J. R. R. Tolkien',
    }),
  },
  BookOrError: {
    // IMPORTANT: Determine which type the union should resolve to
    __resolveType(source, context, info) {
      return source instanceof RateLimit ? 'RateLimit' : 'Book';
    },
  },
};
let schema = makeExecutableSchema({
  typeDefs: [
    rateLimitDirectiveTypeDefs,
    `type Query {
      # Allow field to be queried once every 15 seconds
      favouriteBook: BookOrError! @rateLimit(limit: 1, duration: 15)
    }

    type Book {
      title: String
      author: String
    }

    type RateLimit {
      """
      Maximum allowed per duration.
      """
      limit: Int!
      """
      When the limit will reset.
      """
      resetAt: String!
    }

    union BookOrError = Book | RateLimit`,
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
# Allow field to be queried once every 15 seconds.
# Repeated requests within this time window will return RateLimit object.

query {
  favouriteBook {
    __typename
    ... on Book {
      title
      author
    }
    ... on RateLimit {
      limit
      resetAt
    }
  }
}`
      },
    };
  }),
);
app.listen(4000, () => {
  console.log(`🚀  Server ready at http://localhost:4000/graphql`);
});
