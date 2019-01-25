# GraphQL Rate Limit

[![CircleCI](https://circleci.com/gh/ravangen/graphql-rate-limit.svg?style=shield&circle-token=5115eed32e1e82d43eb00140580186fb8e1563f6)](https://circleci.com/gh/ravangen/graphql-rate-limit) [![Renovate enabled](https://img.shields.io/badge/renovate-enabled-brightgreen.svg)](https://renovateapp.com/) [![npm version](https://img.shields.io/npm/v/graphql-rate-limit-directive.svg?style=popout)](https://www.npmjs.com/package/graphql-rate-limit-directive)

Basic fixed window rate limiting directive for GraphQL. Use to limit repeated requests to queries and/or mutations.

**WARNING**: This package is not yet tested and thus not recommended for production usage.

## Features

- 📇 **Identification**: Distinguish requests using resolver data
- 🎯 **Per-Type or Per-Field**: Limit by types and specific fields
- 📦 **Storage**: Supports multiple data store choices
- ♾️ **Throttles**: Define any number of limits per field
- 😍 **TypeScript**: Written in and exports type definitions

## Install

`yarn add graphql-rate-limit-directive`

## Example

```javascript
const { ApolloServer, gql } = require('apollo-server');
const {
  createRateLimitDirective,
  createRateLimitTypeDef,
} = require('graphql-rate-limit-directive');

const typeDefs = gql`
  # Apply default rate limiting to all fields of 'Query'
  type Query @rateLimit {
    books: [Book!]

    # Override behaviour imposed from 'Query' type on this field to have a custom limit
    quote: String @rateLimit(limit: 1)
  }

  type Book {
    # For each 'Book' where this field is requested, rate limit
    title: String @rateLimit(limit: 72000, duration: 3600)

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
  typeDefs: [createRateLimitTypeDef(), typeDefs],
  resolvers,
  schemaDirectives: {
    rateLimit: createRateLimitDirective(),
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
```

## Configuration

### Request Identification

A key is generated to identify each request for each field being rate limited. The key is recommended to be unique per field to ensure isolation.

By default, a rate limited field is identified by the key `${info.parentType}.${info.fieldName}`. This does _not_ provide user or client independent rate limiting. User A could consume all the capacity and starve out User B.

Provide a customized `keyGenerator` to use `context` information to ensure user/client isolation.

### Target Types and Fields

Apply the directive to types and fields. When applied to a type, it rate limits each of its fields. A rate limit on a field will override a limit imposed by its parent type.

```graphql
# Apply default rate limiting to all fields of 'Query'
type Query @rateLimit(limit: 30, duration: 60) {
  books: [Book!]

  authors: [Author!]

  # Override behaviour imposed from 'Query' type on this field to have different limit
  quote: String @rateLimit(limit: 1, duration: 60)
}
```

### Data Storage

Supports [_Redis_](https://github.com/animir/node-rate-limiter-flexible/wiki/Redis), process [_Memory_](https://github.com/animir/node-rate-limiter-flexible/wiki/Memory), [_Cluster_](https://github.com/animir/node-rate-limiter-flexible/wiki/Cluster) or [_PM2_](https://github.com/animir/node-rate-limiter-flexible/wiki/PM2-cluster), [_Memcached_](https://github.com/animir/node-rate-limiter-flexible/wiki/Memcache), [_MongoDB_](https://github.com/animir/node-rate-limiter-flexible/wiki/Mongo), [_MySQL_](https://github.com/animir/node-rate-limiter-flexible/wiki/MySQL), [_PostgreSQL_](https://github.com/animir/node-rate-limiter-flexible/wiki/PostgreSQL) to control requests rate in single process or distributed environment. Storage options are provided by [`rate-limiter-flexible`](https://github.com/animir/node-rate-limiter-flexible).

Memory store is the default but _not_ recommended for production as it does not share state with other servers or processes.

### Multiple Throttles

Multiple throttles can be used if you want to impose both burst throttling rates, and sustained throttling rates. For example, you might want to limit a user to a maximum of 60 requests per minute, and 1000 requests per day.

Multiple schema directives can be created using different names and assigned to the same location.

```typescript
const schema = makeExecutableSchema({
  typeDefs: [
    createRateLimitTypeDef('burstRateLimit'),
    createRateLimitTypeDef('sustainedRateLimit'),
    typeDefs,
  ],
  resolvers,
  schemaDirectives: {
    burstRateLimit: createRateLimitDirective(),
    sustainedRateLimit: createRateLimitDirective(),
  },
});
```

```graphql
type Query {
  books: [Book]
    @burstRateLimit(limit: 10, duration: 60)
    @sustainedRateLimit(limit: 200, period: 3600)
}
```

**WARNING**: If providing the `keyPrefix` option to `createRateLimitDirective`, consider using directive's name as part of the prefix to ensure isolation between different directives.

#### Unique Directives

As of the June 2018 version of the GraphQL specification, [Directives Are Unique Per Location](https://facebook.github.io/graphql/June2018/#sec-Directives-Are-Unique-Per-Location). A spec [RFC to "Limit directive uniqueness to explicitly marked directives"](https://github.com/facebook/graphql/pull/472) is currently at [Stage 2: Draft](https://github.com/facebook/graphql/blob/master/CONTRIBUTING.md#stage-2-draft). As a result, multiple `@rateLimit` directives can not be defined on the same location.

## Contributions

Contributions, issues and feature requests are very welcome. If you are using this package and fixed a bug for yourself, please consider submitting a PR!

## License

MIT © [Robert Van Gennip](https://github.com/ravangen/)
