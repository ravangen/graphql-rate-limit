# Design

## Persistence

Use existing storage options provided by [`rate-limiter-flexible`](https://github.com/animir/node-rate-limiter-flexible). It is fast, flexible, and friendly to use.

## Implementation Considerations

### GraphQL Directive

A [directive](https://graphql.org/learn/queries/#directives) can be attached to a field or fragment inclusion, and can affect execution of the query in any way the server desires. For example, it can dynamically change the structure and shape of queries using variables. Directives encourage mixing the schema with functionality.

Directives and their arguments are exposed via introspection, enabling client tooling to leverage knowing server configuration.

Custom directives are now easy to create and define on the server, but early in [graphql-js's history (#41)](https://github.com/graphql/graphql-js/issues/41#issuecomment-130554729), user-supplied directives were not an objective.

To apply multiple rate limits on the same field, multiple directives would need to be defined as [Directives Are Unique Per Location](http://spec.graphql.org/June2018/#sec-Directives-Are-Unique-Per-Location).

> Directives are used to describe some metadata or behavioral change on the definition they apply to. When more than one directive of the same name is used, the expected metadata or behavior becomes ambiguous, therefore only one of each directive is allowed per location.

 In newer versions of the spec, being unique per location is no longer required. However, this library continues to assume there not multiple rate limit directives with the same name on the same field.

### GraphQL Middleware

[Wrap a schema](https://github.com/prisma/graphql-middleware) to manage additional functionality across multiple resolvers efficiently.

GraphQL Middleware enables running arbitrary code before or after a resolver is invoked. It improves code structure by enabling code reuse and a clear separation of concerns.

### Validation Rule

Hook into the [Validation phase](https://graphql.org/graphql-js/validation/) of fulfilling a GraphQL result.

Validation runs synchronously, returning an array of encountered errors, or an empty array if no errors were encountered and the document is valid. A validation rule is defined as `(context: ValidationContext) => ASTVisitor`.

In [spectrum #2874](https://github.com/withspectrum/spectrum/pull/2874#issuecomment-381711121) Lee Byron notes that the rules tend to apply in both server and client (tooling) scenarios. He suggests not implementing rate limiting as a validation rule, but instead as it’s own step.

A limited set of context information is available from [`ValidationContext`](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/graphql/validation/ValidationContext.d.ts). This is **not** the resolver context which commonly holds important contextual information like the currently logged in user.
