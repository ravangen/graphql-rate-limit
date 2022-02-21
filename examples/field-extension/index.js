const { makeExecutableSchema } = require('@graphql-tools/schema');
const express = require('express');
const { graphqlHTTP } = require('express-graphql');
const {
  defaultKeyGenerator,
  defaultSetState,
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

// IMPORTANT: Specify how a rate limited field should determine uniqueness/isolation of operations
// Uses the combination of user specific data (their ip) along the type and field being accessed
const keyGenerator = (directiveArgs, source, args, context, info) =>
  `${context.ip}:${defaultKeyGenerator(directiveArgs, source, args, context, info)}`;

// IMPORTANT: Specify how many points should be consumed in different situations
const pointsCalculator = (directiveArgs, source, args, context, info) => {
  // When query string `token=secret` is used, allow unlimited usage, else costs 2 for `books`
  return context.requestQuery && context.requestQuery.token === 'secret' ? 0 : 2;
};

const directiveName = 'rateLimit';
const {
  rateLimitDirectiveTypeDefs,
  rateLimitDirectiveTransformer,
} = rateLimitDirective({
  name: directiveName,
  limiterClass: DebugRateLimiterMemory
});

const resolvers = {
  Query: {
    books: {
      resolve: () => [
        {
          title: 'A Game of Thrones',
          author: 'George R. R. Martin',
        },
        {
          title: 'The Hobbit',
          author: 'J. R. R. Tolkien',
        },
      ],
      extensions: {
        // IMPORTANT: Specify any overrides via field's extensions under directive's name
        [directiveName]: {
          keyGenerator,
          pointsCalculator,
        }
      }
    },
    quote: {
      resolve: () =>
        'The future is something which everyone reaches at the rate of sixty minutes an hour, whatever he does, whoever he is. ― C.S. Lewis',
      extensions: {
        // IMPORTANT: Specify any overrides via field's extensions under directive's name
        [directiveName]: {
          onLimit: () => 'So comes snow after fire, and even dragons have their endings. ― Bilbo Baggins',
          setState: defaultSetState(directiveName),
        }
      }
    },
  },
};
let schema = makeExecutableSchema({
  typeDefs: [
    rateLimitDirectiveTypeDefs,
    `# Allow each field to be queried four times every 15 seconds
    type Query @rateLimit(limit: 4, duration: 15) {
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
      context: {
        // See https://expressjs.com/en/api.html#req.ip
        ip: request.ip, // Express uses IPv6 by default
        // See https://expressjs.com/en/api.html#req.query
        requestQuery: request.query, // object containing a property for each query string parameter in the route
      },
      graphiql: {
        defaultQuery: `# Welcome to GraphiQL
#
# Allow quote field to be queried 4 times every 15 seconds.
# The quote will change when the rate limit is exceeded.
# Allow books field to be queried 2 times every 15 seconds.
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
