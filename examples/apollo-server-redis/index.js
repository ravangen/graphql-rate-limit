const { ApolloServer, gql } = require('apollo-server');
const { createRateLimitDirective, RateLimitTypeDefs } = require('../../dist/index');

const books = [
  {
    title: 'A Game of Thrones',
    author: 'George R. R. Martin',
  },
  {
    title: 'The Hobbit',
    author: '	J. R. R. Tolkien',
  },
];

const typeDefs = gql`
  type Book {
    title: String @rateLimit(period: DAY)
    author: String
  }

  type Query @rateLimit {
    books: [Book!]
    quote: String @rateLimit(max: 15)
  }
`;

const resolvers = {
  Query: {
    books: () => books,
    quote: () => 'The future is something which everyone reaches at the rate of sixty minutes an hour, whatever he does, whoever he is. ― C.S. Lewis',
  },
};

const server = new ApolloServer({
  typeDefs: [RateLimitTypeDefs, typeDefs],
  resolvers,
  schemaDirectives: {
    rateLimit: createRateLimitDirective(),
  },
});
server.listen()
  .then(({ url }) => {
    console.log(`🚀  Server ready at ${url}`);
  })
  .catch(error => {
    console.error(error);
  });
