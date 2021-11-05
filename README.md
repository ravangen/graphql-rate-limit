# GraphQL Rate Limit

[![CircleCI](https://img.shields.io/circleci/project/github/ravangen/graphql-rate-limit/master.svg?style=popout)](https://circleci.com/gh/ravangen/graphql-rate-limit)
[![Codecov](https://img.shields.io/codecov/c/github/ravangen/graphql-rate-limit.svg?style=popout)](https://codecov.io/gh/ravangen/graphql-rate-limit)
[![npm Version](https://img.shields.io/npm/v/graphql-rate-limit-directive.svg?style=popout)](https://www.npmjs.com/package/graphql-rate-limit-directive)
[![npm Downloads](https://img.shields.io/npm/dm/graphql-rate-limit-directive.svg?style=popout)](https://www.npmjs.com/package/graphql-rate-limit-directive)
[![Dependency Status](https://img.shields.io/librariesio/github/ravangen/graphql-rate-limit)](https://github.com/ravangen/graphql-rate-limit/pulls/app%2Frenovate)

Fixed window rate limiting directive for GraphQL. Use to limit repeated requests to queries and mutations.

## Features

- 👨‍💻 **Identification**: Distinguish requests using resolver data
- 🎯 [**Per-Object or Per-Field**](#step-3-attach-directive-to-field-or-object): Limit by objects and specific fields
- 📦 [**Storage**](#limiterclass): Supports multiple data store choices (_Redis_, process _Memory_, ...)
- ♾️ [**Throttles**](examples/multiple): Define any number of limits per field
- 😍 **TypeScript**: Written in and exports type definitions

## Install

```bash
yarn add graphql-rate-limit-directive
```

## How it works

GraphQL Rate Limit wraps resolvers, ensuring an action is permitted before it is invoked. A client is allocated a maximum of `n` operations for every fixed size time window. Once the client has performed `n` operations, they must wait.

## Setup

### Step 1: Define directive type definition and transformer

Import `rateLimitDirective` and configure behaviour of directive (see [options](#ratelimitdirectiveoptions)).

```javascript
const { rateLimitDirective } = require('graphql-rate-limit-directive');

const { rateLimitDirectiveTypeDefs, rateLimitDirectiveTransformer } = rateLimitDirective();
```

### Step 2: Add directive to schema

Include `rateLimitDirectiveTypeDefs` as part of the schema's type definitions.

Transform schema with `rateLimitDirectiveTransformer` to apply implementation of directive.

```javascript
const { makeExecutableSchema } = require('@graphql-tools/schema');

let schema = makeExecutableSchema({
  typeDefs: [
    rateLimitDirectiveTypeDefs,
    /* plus any existing type definitions */
  ],
  /* ... */
});

schema = rateLimitDirectiveTransformer(schema);
```

### Step 3: Attach directive to field or object

Attach `@rateLimit` directive where desired. Argument `limit` is number of allow operations per duration. Argument `duration` is the length of the fixed window (in seconds).

```graphql
# Apply rate limiting to all fields of 'Query'
# Allow at most 60 queries per field within a minute
type Query @rateLimit(limit: 60, duration: 60) {
  ...
}
```

#### Overrides

When the directive is applied to a object, it rate limits each of its fields. A rate limit on a field will override a limit imposed by its parent type.

```graphql
# Apply default rate limiting to all fields of 'Query'
type Query @rateLimit(limit: 60, duration: 60) {
  books: [Book!]

  authors: [Author!]

  # Override behaviour imposed from 'Query' object on this field to have different limit
  quote: String @rateLimit(limit: 1, duration: 60)
}
```

## Example

Additional, advanced examples are available in the [examples](examples) folder:

- [Context](examples/context): isolating operations between users
- [Points](examples/points): customize the cost of a field resolution
- [Redis](examples/redis): share state in a distrubuted environment
- [Multiple](examples/multiple): applying multiple rate limits on the same field
- [onLimit Error](examples/onlimit-error): custom error raised
- [onLimit Object](examples/onlimit-object): custom result instead of default resolution

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

    # Override behaviour imposed from 'Query' object on this field to have a custom limit
    quote: String @rateLimit(limit: 1)
  }

  type Book {
    # For each 'Book' where this field is requested, rate limit
    title: String @rateLimit(limit: 72000, duration: 3600)

    # No limits are applied
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

## API

### `rateLimitDirective(options)`

> Create an implementation of a rate limit directive.

It is common to specify at least [`keyGenerator`](#keyGenerator) and [`limiterClass`](#limiterClass) as part of `options`.

Returns an object containing:
- `rateLimitDirectiveTypeDefs`: Schema Definition Language (SDL) representation of the directive.
- `rateLimitDirectiveTransformer`: Function to apply the directive's logic to the provided schema.

#### `name`

> Name of the directive.

Override the name of the directive, defaults to `rateLimit`.

#### `defaultLimit`

> Default value for argument limit.

Override the directive's `limit` argument's default value, defaults to `60`.

#### `defaultDuration`

> Default value for argument duration.

Override the directive's `duration` argument's default value, defaults to `60`.

#### `keyGenerator`

> Constructs a key to represent an operation on a field.

A key is generated to identify each request for each field being rate limited. To ensure isolation, the key is recommended to be unique per field. Supports both synchronous and asynchronous functions.

By default, it does _not_ provide user or client independent rate limiting. See [`defaultKeyGenerator`](#defaultkeygeneratordirectiveargs-obj-args-context-info) and [context example](examples/context).

**WARNING**: Inside a generator function, consider accessing the GraphQL `context` or memoizing any expensive calls (HTTP, database, ...) as the functions is run for each rate limited field.

#### `limiterClass`

> An implementation of a limiter.

Storage implementations are provided by [`rate-limiter-flexible`](https://github.com/animir/node-rate-limiter-flexible).

Supports [_Redis_](https://github.com/animir/node-rate-limiter-flexible/wiki/Redis), process [_Memory_](https://github.com/animir/node-rate-limiter-flexible/wiki/Memory), [_Cluster_](https://github.com/animir/node-rate-limiter-flexible/wiki/Cluster) or [_PM2_](https://github.com/animir/node-rate-limiter-flexible/wiki/PM2-cluster), [_Memcached_](https://github.com/animir/node-rate-limiter-flexible/wiki/Memcache), [_MongoDB_](https://github.com/animir/node-rate-limiter-flexible/wiki/Mongo), [_MySQL_](https://github.com/animir/node-rate-limiter-flexible/wiki/MySQL), [_PostgreSQL_](https://github.com/animir/node-rate-limiter-flexible/wiki/PostgreSQL) to control requests rate in single process or distributed environment.

Memory store is the default but _not_ recommended for production as it does not share state with other servers or processes. See [Redis example](examples/redis) for use in a distributed environment.

#### `limiterOptions`

> Configuration to apply to created limiters.

**WARNING**: If providing the `keyPrefix` option, consider using directive's name as part of the prefix to ensure isolation between different directives.

#### `pointsCalculator`

> Calculate the number of points to consume.

Default with [`defaultPointsCalculator`](#defaultpointscalculatordirectiveargs-obj-args-context-info) is to cost one point.

- A positve number reduces the remaining points for consumption for one duration.
- A zero skips consuming points (like a whitelist).
- A negative number increases the available points for consumption for one duration.

#### `onLimit`

> Behaviour when limit is exceeded.

Throw an error or return an object describing a reached limit and when it will reset. Default is to throw an error using [`defaultOnLimit`](#defaultonlimitresource-directiveargs-obj-args-context-info). See [error example](examples/onlimit-error) and [object example](examples/onlimit-object).

### `defaultKeyGenerator(directiveArgs, source, args, context, info)`

> Get a value to uniquely identify a field in a schema.

A field is identified by the key `${info.parentType}.${info.fieldName}`. This does _not_ provide user or client independent rate limiting. User A could consume all the capacity and starve out User B.

This function can be used in conjunction with `context` information to ensure user/client isolation. See [context example](examples/context).

#### `directiveArgs`

The arguments defined in the schema for the directive.

#### `source`

The previous result returned from the resolver on the parent field.

#### `args`

The arguments provided to the field in the GraphQL operation.

#### `context`

Contains per-request state shared by all resolvers in a particular operation.

#### `info`

Holds field-specific information relevant to the current operation as well as the schema details.

### `defaultPointsCalculator(directiveArgs, source, args, context, info)`

> Calculate the number of points to consume.

Cost one point.

#### `directiveArgs`

The arguments defined in the schema for the directive.

#### `source`

The previous result returned from the resolver on the parent field.

#### `args`

The arguments provided to the field in the GraphQL operation.

#### `context`

Contains per-request state shared by all resolvers in a particular operation.

#### `info`

Holds field-specific information relevant to the current operation as well as the schema details.

### `defaultOnLimit(resource, directiveArgs, source, args, context, info)`

> Raise a rate limit error when there are too many requests.

Throws a `GraphQLError` with message `Too many requests, please try again in N seconds.`

#### `resource`

The current rate limit information for this field.

#### `directiveArgs`

The arguments defined in the schema for the directive.

#### `source`

The previous result returned from the resolver on the parent field.

#### `args`

The arguments provided to the field in the GraphQL operation.

#### `context`

Contains per-request state shared by all resolvers in a particular operation.

#### `info`

Holds field-specific information relevant to the current operation as well as the schema details.

## Contributions

Contributions, issues and feature requests are very welcome.

If you are using this package and fixed a bug for yourself, please consider submitting a PR!

## License

MIT © [Rob Van Gennip](https://github.com/ravangen/)
