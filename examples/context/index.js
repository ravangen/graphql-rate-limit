const { makeExecutableSchema } = require('@graphql-tools/schema');
const express = require('express');
const { graphqlHTTP } = require('express-graphql');
const { defaultKeyGenerator, rateLimitDirective } = require('graphql-rate-limit-directive');
const { RateLimiterMemory } = require('rate-limiter-flexible');

// This is not necessary, it exists to demonstrate when we check the rate limit usage
class DebugRateLimiterMemory extends RateLimiterMemory {
  consume(key, pointsToConsume, options) {
    console.log(`[CONSUME] ${key} for ${pointsToConsume}`);
    return super.consume(key, pointsToConsume, options);
  }
}

// IMPORTANT: Specify how a rate limited field should determine uniqueness/isolation of operations
// Uses the combination of user specific data (their ip) along the type and field being accessed
const keyGenerator = (directiveArgs, source, args, context, info) =>
  `${context.ip}:${defaultKeyGenerator(directiveArgs, source, args, context, info)}`;

const { rateLimitDirectiveTypeDefs, rateLimitDirectiveTransformer } = rateLimitDirective({
  keyGenerator,
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
      // IMPORTANT: Build GraphQL context from request data (like userId and/or ip)
      context: {
        // See https://expressjs.com/en/api.html#req.ip
        ip: request.ip, // Express uses IPv6 by default
      },
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
