const { makeExecutableSchema } = require('@graphql-tools/schema');
const express = require('express');
const { graphqlHTTP } = require('express-graphql');
const { defaultPointsCalculator, rateLimitDirective } = require('graphql-rate-limit-directive');
const { RateLimiterMemory } = require('rate-limiter-flexible');

// This is not necessary, it exists to demonstrate when we check the rate limit usage
class DebugRateLimiterMemory extends RateLimiterMemory {
  consume(key, pointsToConsume, options) {
    // When pointsToConsume is 0, consume does not get called
    console.log(`[CONSUME] ${key} for ${pointsToConsume}`);
    return super.consume(key, pointsToConsume, options);
  }
}

// IMPORTANT: Specify how many points should be consumed in different situations
const pointsCalculator = (directiveArgs, source, args, context, info) => {
  // If a specific resolver for a type and field, use custom logic
  if (info.parentType.name === 'Query' && info.fieldName === 'books') {
    // When query string `token=secret` is used, allow unlimited usage, else costs 2 for `books`
    return context.requestQuery && context.requestQuery.token === 'secret' ? 0 : 2;
  } else {
    return defaultPointsCalculator(directiveArgs, source, args, context, info);
  }
};

const { rateLimitDirectiveTypeDefs, rateLimitDirectiveTransformer } = rateLimitDirective({
  pointsCalculator,
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
    `# Give each field 10 points capacity every 30 seconds
    type Query @rateLimit(limit: 10, duration: 30) {
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
        // See https://expressjs.com/en/api.html#req.query
        requestQuery: request.query, // object containing a property for each query string parameter in the route
      },
      graphiql: {
        defaultQuery: `# Welcome to GraphiQL
#
# Allow quote field to be queried 10 times every 30 seconds.
# Allow books field to be queried 5 times every 30 seconds.
# Add ?token=secret query string to the URL to allow unlimited books field queries.

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
