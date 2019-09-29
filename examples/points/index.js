const { ApolloServer, gql } = require('apollo-server');
const {
  createRateLimitDirective,
  createRateLimitTypeDef,
  defaultPointsCalculator,
} = require('graphql-rate-limit-directive');

const typeDefs = gql`
  # Give each field a 10 points every 30 seconds
  type Query @rateLimit(limit: 10, duration: 30) {
    books: [Book!]
    quote: String
  }

  type Book {
    title: String
    author: String
  }
`;
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

// IMPORTANT: Specify how many points should be consumed in different situations
const pointsCalculator = (directiveArgs, obj, args, context, info) => {
  // If a specific resolver for a type and field, use custom logic
  if (info.parentType.name === 'Query' && info.fieldName === 'books') {
    // When query string `token=secret` is used, allow unlimited usage, else costs 2 for `books`
    return context.query && context.query.token === 'secret' ? 0 : 2;
  } else {
    return defaultPointsCalculator(directiveArgs, obj, args, context, info);
  }
};

const server = new ApolloServer({
  typeDefs: [createRateLimitTypeDef(), typeDefs],
  resolvers,
  // IMPORTANT: Build GraphQL context from request data (like userId and/or ip)
  context: ({ req }) => ({
    // See https://expressjs.com/en/api.html#req.query
    query: req.query, // object containing a property for each query string parameter in the route
  }),
  schemaDirectives: {
    rateLimit: createRateLimitDirective({
      pointsCalculator,
    }),
  },
});
server
  .listen()
  .then(({ url }) => {
    console.log(`🚀  Server ready at ${url}`);
  })
  .catch(error => {
    console.error(error);
  });
