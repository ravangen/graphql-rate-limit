const { ApolloServer, gql } = require('apollo-server');
const {
  createRateLimitDirective,
  createRateLimitTypeDef,
  defaultKeyGenerator,
} = require('graphql-rate-limit-directive');

const typeDefs = gql`
  # Allow each field to be queried once every 15 seconds
  type Query @rateLimit(limit: 1, duration: 15) {
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

// IMPORTANT: Specify how a rate limited field should determine uniqueness/isolation of operations
// Uses the combination of user specific data (their ip) along the type and field being accessed
const keyGenerator = (directiveArgs, obj, args, context, info) =>
  `${context.ip}:${defaultKeyGenerator(
    directiveArgs,
    obj,
    args,
    context,
    info,
  )}`;

const server = new ApolloServer({
  typeDefs: [createRateLimitTypeDef(), typeDefs],
  resolvers,
  // IMPORTANT: Build GraphQL context from request data (like userId and/or ip)
  context: ({ req }) => ({
    // See https://expressjs.com/en/api.html#req.ip
    ip: req.ip, // Express uses IPv6 by default
  }),
  schemaDirectives: {
    rateLimit: createRateLimitDirective({
      keyGenerator,
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
