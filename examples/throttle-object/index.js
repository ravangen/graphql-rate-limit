const { ApolloServer, gql } = require('apollo-server');
const {
  createRateLimitDirective,
  createRateLimitTypeDef,
} = require('graphql-rate-limit-directive');

const typeDefs = gql`
  type Query {
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
    limit: Int
    """
    When the limit will reset.
    """
    resetAt: String
  }

  union BookOrError = Book | RateLimit
`;
const resolvers = {
  Query: {
    favouriteBook: () => ({
      title: 'The Hobbit',
      author: 'J. R. R. Tolkien',
    }),
  },
  BookOrError: {
    // IMPORTANT: Instruct Apollo Server how to determine which type the union should resolve to
    __resolveType(obj, context, info) {
      return obj instanceof RateLimit ? 'RateLimit' : 'Book';
    },
  },
};

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
const throttle = (resource, directiveArgs, source, args, context, info) =>
  new RateLimit(directiveArgs.limit, resource.msBeforeNext);

const server = new ApolloServer({
  typeDefs: [createRateLimitTypeDef(), typeDefs],
  resolvers,
  schemaDirectives: {
    rateLimit: createRateLimitDirective({
      throttle,
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
