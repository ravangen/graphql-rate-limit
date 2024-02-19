import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { rateLimitDirective } from 'graphql-rate-limit-directive';
import { RateLimiterMemory } from 'rate-limiter-flexible';

// This is not necessary, it exists to demonstrate when we check the rate limit usage
class DebugRateLimiterMemory extends RateLimiterMemory {
  consume(key, pointsToConsume, options) {
    console.log(`[CONSUME] ${key} for ${pointsToConsume}`);
    return super.consume(key, pointsToConsume, options);
  }
}

const {
  rateLimitDirectiveTypeDefs,
  rateLimitDirectiveTransformer
} = rateLimitDirective({
  limiterClass: DebugRateLimiterMemory
});

const typeDefs = `#graphql
  type Book {
    title: String
    author: String
  }

  # Apply rate limiting to all fields of 'Query'
  # Allow at most 2 queries per field within 10 seconds
  type Query @rateLimit(limit: 2, duration: 10) {
    books: [Book]
  }
`;

const books = [
  {
    title: 'The Awakening',
    author: 'Kate Chopin',
  },
  {
    title: 'City of Glass',
    author: 'Paul Auster',
  },
];

const resolvers = {
  Query: {
    books: () => books,
  },
};

const schema = rateLimitDirectiveTransformer(
  makeExecutableSchema({
    typeDefs: [
      rateLimitDirectiveTypeDefs,
      typeDefs,
    ],
    resolvers,
  })
);

const server = new ApolloServer({
  schema,
});

// Passing an ApolloServer instance to the `startStandaloneServer` function:
//  1. creates an Express app
//  2. installs your ApolloServer instance as middleware
//  3. prepares your app to handle incoming requests
const { url } = await startStandaloneServer(server, {
  listen: { port: 4000 },
});

console.log(`🚀  Server ready at: ${url}`);
