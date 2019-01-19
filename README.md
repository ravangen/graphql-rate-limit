# GraphQL Rate Limit

[![CircleCI](https://circleci.com/gh/ravangen/graphql-rate-limit.svg?style=shield&circle-token=5115eed32e1e82d43eb00140580186fb8e1563f6)](https://circleci.com/gh/ravangen/graphql-rate-limit) [![Renovate enabled](https://img.shields.io/badge/renovate-enabled-brightgreen.svg)](https://renovateapp.com/)

Basic fixed window rate limiting directive for GraphQL. Use to limit repeated requests to queries and/or mutations.

## Features

- 🎯 **Per-Type or Per-Field**: Limit types and specific fields
- 📦 **Storage**: Supports multiple data store choices
- ♾️ **Throttles**: Define any number of limits per field
- 😍 **TypeScript**: Written in and exports type definitions

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

Multiple schema directives can be created using different names and assigned to the same location. Provide the `directiveName` option to `createRateLimitDirective()`.

```typescript
const schema = makeExecutableSchema({
  ...
  schemaDirectives: {
    burstRateLimit: createRateLimitDirective({directiveName: 'burstRateLimit'}),
    sustainedRateLimit: createRateLimitDirective({directiveName: 'sustainedRateLimit'}),
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

#### Unique Directives

As of the June 2018 version of the GraphQL specification, [Directives Are Unique Per Location](https://facebook.github.io/graphql/June2018/#sec-Directives-Are-Unique-Per-Location). A spec [RFC to "Limit directive uniqueness to explicitly marked directives"](https://github.com/facebook/graphql/pull/472) is currently at [Stage 2: Draft](https://github.com/facebook/graphql/blob/master/CONTRIBUTING.md#stage-2-draft). As a result, multiple `@rateLimit` directives can not be defined on the same location.

## Contributions

Contributions, issues and feature requests are very welcome. If you are using this package and fixed a bug for yourself, please consider submitting a PR!

## License

MIT © [Robert Van Gennip](https://github.com/ravangen/)
