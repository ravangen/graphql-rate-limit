const { ApolloServer, gql } = require('apollo-server');
const {
  createRateLimitDirective,
  createRateLimitTypeDef,
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

const server = new ApolloServer({
  typeDefs: [createRateLimitTypeDef(), typeDefs],
  resolvers,
  schemaDirectives: {
    rateLimit: createRateLimitDirective({
      onLimit,
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
