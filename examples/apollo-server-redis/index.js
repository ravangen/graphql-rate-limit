const { ApolloServer, gql } = require('apollo-server');
// import { createRateLimitDirective, RateLimitTypeDefs } from './index';

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
    title: String
    author: String
  }

  type Query {
    books: [Book!]
    quote: String
  }
`;

const resolvers = {
  Query: {
    books: () => books,
    quote: () => 'The future is something which everyone reaches at the rate of sixty minutes an hour, whatever he does, whoever he is. ― C.S. Lewis',
  },
};

const server = new ApolloServer({
  typeDefs,
  resolvers,
});
server.listen()
  .then(({ url }) => {
    console.log(`🚀  Server ready at ${url}`);
  })
  .catch(error => {
    console.error(error);
  });
