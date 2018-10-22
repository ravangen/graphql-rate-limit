import { ApolloServer, gql } from 'apollo-server';
import { makeExecutableSchema } from 'graphql-tools';
import { createRateLimitDirective, RateLimitTypeDefs } from './index';

const books = [
  {
    title: 'Harry Potter and the Chamber of Secrets',
    author: 'J.K. Rowling',
  },
  {
    title: 'Jurassic Park',
    author: 'Michael Crichton',
  },
];

const typeDefs = gql`
  type Book {
    title: String @rateLimit(period: DAY)
    author: String
  }

  type Query @rateLimit {
    books: [Book]
    greeting: String @rateLimit(max: 15)
  }
`;

const resolvers = {
  Query: {
    books: () => books,
    greeting: () => 'Hello!',
  },
};

const schema = makeExecutableSchema({
  typeDefs: [RateLimitTypeDefs, typeDefs],
  resolvers,
  schemaDirectives: {
    rateLimit: createRateLimitDirective(),
  },
});

const server = new ApolloServer({ schema });
server.listen().then(({ url }) => {
  console.log(`🚀  Server ready at ${url}`);
});
