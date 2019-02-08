const { ApolloServer, gql } = require('apollo-server');
const {
  createRateLimitDirective,
  createRateLimitTypeDef,
} = require('graphql-rate-limit-directive');

const typeDefs = gql`
  type Query {
    # IMPORTANT: Both rate limits will be applied for each field, including when one limits and the other doesn't
    # Allow once every 15 seconds and three times every 60 seconds
    books: [Book!]
      @burstRateLimit(limit: 1, duration: 15)
      @sustainedRateLimit(limit: 3, duration: 60)
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

const server = new ApolloServer({
  // IMPORTANT: Include directive type definitions for both @burstRateLimit and @sustainedRateLimit
  typeDefs: [
    createRateLimitTypeDef('burstRateLimit'),
    createRateLimitTypeDef('sustainedRateLimit'),
    typeDefs,
  ],
  resolvers,
  schemaDirectives: {
    // IMPORTANT: Include directive implementations (directive name is determined by the key)
    burstRateLimit: createRateLimitDirective(),
    sustainedRateLimit: createRateLimitDirective(),
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
