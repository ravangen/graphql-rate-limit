# Design

## Implementation Considerations

### Validation Rule

Hook into the [Validation phase](https://graphql.org/graphql-js/validation/) of fulfilling a GraphQL result.

Validation runs synchronously, returning an array of encountered errors, or an empty array if no errors were encountered and the document is valid.

In [spectrum #2874](https://github.com/withspectrum/spectrum/pull/2874#issuecomment-381711121) Lee Byron notes that the rules tend to apply in both server and client (tooling) scenarios. He suggests not implementing rate limiting as a validation rule, but instead as it’s own step.

A validation rule function is defined as `(context: ValidationContext): any`.

A limited set of context information is available from [`ValidationContext`](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/graphql/validation/ValidationContext.d.ts). This is **not** the resolver context which commonly holds important contextual information like the currently logged in user.

### GraphQL Directive

A [directive](https://graphql.org/learn/queries/#directives) can be attached to a field or fragment inclusion, and can affect execution of the query in any way the server desires. For example, it dynamically change the structure and shape of queries using variables. 

Directives encourage mixing the schema with functionality.

Custom directives are now easy to create and define on the server, but early in [graphql-js's history (#41)](https://github.com/graphql/graphql-js/issues/41#issuecomment-130554729), user-supplied directives were not an objective.

A graphql-js RFC exists to add [support for repeatable directives (#1541)](https://github.com/graphql/graphql-js/pull/1541). This is to adjust the spec's [Directives Are Unique Per Location](https://facebook.github.io/graphql/June2018/#sec-Directives-Are-Unique-Per-Location). Currently, multiple `@rateLimit` directives could not be defined on the same location.
> Directives are used to describe some metadata or behavioral change on the definition they apply to. When more than one directive of the same name is used, the expected metadata or behavior becomes ambiguous, therefore only one of each directive is allowed per location.

#### Gist

- [`class RateLimitDirective extends SchemaDirectiveVisitor`](https://github.com/apollographql/graphql-tools/blob/master/src/schemaVisitor.ts)
  - NOTE: The class may be instantiated multiple times to visit multiple different occurrences of the same directive
- Override [`visitFieldDefinition`](https://github.com/apollographql/graphql-tools/blob/master/src/schemaVisitor.ts#L90-L92) and use parameter [`field: GraphQLField`](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/graphql/type/definition.d.ts)
- `field` has access to [`astNode?: Maybe<FieldDefinitionNode>`](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/graphql/language/ast.d.ts) and [`resolve?: GraphQLFieldResolver`](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/graphql/type/definition.d.ts) (if we were to want to modify the actual execution)
- `astNode` has access to [`directives?: ReadonlyArray<DirectiveNode>`](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/graphql/language/ast.d.ts)
- Each `directive` has access to [`arguments?: ReadonlyArray<ArgumentNode>`](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/graphql/language/ast.d.ts)
- Each `argument` has access to [`name: NameNode`](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/graphql/language/ast.d.ts) and [`value: ValueNode`](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/graphql/language/ast.d.ts)

### GraphQL Middleware

[Wrap a schema](https://github.com/prisma/graphql-middleware) to manage additional functionality across multiple resolvers efficiently.

GraphQL Middleware enables running arbitrary code before or after a resolver is invoked. It improves code structure by enabling code reuse and a clear separation of concerns.

## Throttling

### Multiple Rates

- Burst (60/minute)
- Sustained (1000/day)

Valid periods of time: `second`, `minute`, `hour`, or `day`

### Nodes

- Number of records being accessed

## Client Identification

Ideally this is available in the [execution `context`](https://graphql.org/learn/execution/).

Information could include:
- Remote IP address
- User Id
- Application Id

## Stores

The storage to use when persisting rate limit attempts.

Use the same Store inferface of [Express Rate Limit](https://github.com/nfriedly/express-rate-limit#store).

```typescript
interface Store {
  incr(key: string, cb: StoreIncrementCallback): void;
  decrement(key: string): void;
  resetKey(key: string): void;
}
```

Available data stores are:

- MemoryStore: _(default)_ Simple in-memory option. Does not share state when app has multiple processes or servers.
- [rate-limit-redis](https://npmjs.com/package/rate-limit-redis): A [Redis](http://redis.io/)-backed store, more suitable for large or demanding deployments.
- [rate-limit-memcached](https://npmjs.org/package/rate-limit-memcached): A [Memcached](https://memcached.org/)-backed store.
