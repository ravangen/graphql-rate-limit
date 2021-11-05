## 2.0.0 - 2021-11-05

- Update dependencies, minimum `graphql-tools` version is now `8`
- `IOptions` renamed to `RateLimitOptions`, adds `name`, `defaultLimit`, `defaultDuration` optional arguments.

### Version 2 Migration

Due to interface changes with `graphql-tools`, the approach to setting up the directive has changed:

```diff
const { makeExecutableSchema } = require('@graphql-tools/schema');
const {
- createRateLimitDirective,
- createRateLimitTypeDef,
+ rateLimitDirective
} = require('graphql-rate-limit-directive');

+ const { rateLimitDirectiveTypeDefs, rateLimitDirectiveTransformer } = rateLimitDirective();

let schema = makeExecutableSchema({
  typeDefs: [
-   createRateLimitTypeDef(),
+   rateLimitDirectiveTypeDefs,
    /* other defs */
  ],
  resolvers,
- schemaDirectives: {
-   rateLimit: createRateLimitDirective(),
- },
});
+ schema = rateLimitDirectiveTransformer(schema);
```

## 1.3.0 – 2021-04-01

- Update dependencies, minimum `GraphQL.js` version is now `15`

## 1.2.1 – 2020-02-01

- Update dependencies and examples

## 1.2.0 – 2019-09-29

- Add `pointsCalculator` option to dynamically calculate how many points to consume
- Update `createRateLimitTypeDef` to have non-nullable `limit` and `duration` arguments
- Update dependencies

## 1.1.0 – 2019-05-04

- Support for async `keyGenerator`

## 1.0.2 – 2019-04-28

- Update dependencies
- Improve documentation

## 1.0.1 – 2019-02-22

- Export `defaultKeyGenerator` and `defaultOnLimit`

## 1.0.0 – 2019-02-17

- Rename `throttle` to `onLimit` to better describe when function is run

## 0.1.0 – 2019-02-06

- Include examples of how to use package

## 0.0.3 – 2019-01-27

- Added test coverage

## 0.0.2 – 2019-01-24

- Replace `rateLimitTypeDefs` with `createRateLimitTypeDef()`

## 0.0.1 – 2019-01-23

- Initial release
