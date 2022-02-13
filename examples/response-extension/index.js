const { makeExecutableSchema } = require('@graphql-tools/schema');
const express = require('express');
const { graphqlHTTP } = require('express-graphql');
const {
  defaultGetState,
  millisecondsToSeconds,
  rateLimitDirective
} = require('graphql-rate-limit-directive');
const { RateLimiterMemory } = require('rate-limiter-flexible');

// This is not necessary, it exists to demonstrate when we check the rate limit usage
class DebugRateLimiterMemory extends RateLimiterMemory {
  consume(key, pointsToConsume, options) {
    console.log(`[CONSUME] ${key} for ${pointsToConsume}`);
    return super.consume(key, pointsToConsume, options);
  }
}

const directiveName = 'rateLimit';
const getState = defaultGetState(directiveName);
const {
  rateLimitDirectiveTypeDefs,
  rateLimitDirectiveTransformer,
} = rateLimitDirective({
  name: directiveName,
  getState, // IMPORTANT: Where to store the request's rate limit state in context
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
    `# Allow each field to be queried three times every 15 seconds
    type Query @rateLimit(limit: 3, duration: 15) {
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
      extensions: (info) => {
        // IMPORTANT: Fetch the request's rate limit state from context
        const state = getState(info.context);
        return {
          [directiveName]: Object.entries(state).reduce((accumulator, [coordinate, response]) => {
            accumulator[coordinate] = {
              remaining: response.remainingPoints,
              consumed: response.consumedPoints,
              resets: millisecondsToSeconds(response.msBeforeNext),
            };
            return accumulator;
          }, {}),
        };
      },
      graphiql: {
        defaultQuery: `# Welcome to GraphiQL
#
# Allow each field to be queried three times every 15 seconds.
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
