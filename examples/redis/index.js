require('dotenv').config();
const { ApolloServer, gql } = require('apollo-server');
const {
  createRateLimitDirective,
  createRateLimitTypeDef,
} = require('graphql-rate-limit-directive');
const { RateLimiterRedis } = require('rate-limiter-flexible');
const redis = require('redis');

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

// IMPORTANT: Create a client to provide into createRateLimitDirective
const redisClient = redis.createClient({
  url: process.env.REDIS_URL,
  password: process.env.REDIS_PASSWORD,
  enable_offline_queue: false, // must be created with offline queue switched off
});
redisClient.on('error', error => {
  console.log(error);
});

const server = new ApolloServer({
  typeDefs: [createRateLimitTypeDef(), typeDefs],
  resolvers,
  schemaDirectives: {
    rateLimit: createRateLimitDirective({
      // IMPORTANT: Tell the directive's limiter to use RateLimiterRedis along with specific options
      limiterClass: RateLimiterRedis,
      limiterOptions: {
        storeClient: redisClient,
      },
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
