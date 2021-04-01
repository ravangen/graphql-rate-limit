import { graphql, DirectiveDefinitionNode, GraphQLResolveInfo } from 'graphql';
import gql from 'graphql-tag';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { IResolverValidationOptions } from '@graphql-tools/utils';
import {
  IRateLimiterOptions,
  RateLimiterMemory,
  RateLimiterRes,
} from 'rate-limiter-flexible';
import {
  createRateLimitDirective,
  createRateLimitTypeDef,
  RateLimitArgs,
} from '../index';

describe('createRateLimitTypeDef', () => {
  it('creates custom directive definition', () => {
    const directiveName = 'customRateLimit';
    const directiveTypeDef = createRateLimitTypeDef(directiveName);
    const directiveDefinition = directiveTypeDef.definitions.find(
      (definition): definition is DirectiveDefinitionNode =>
        definition.kind == 'DirectiveDefinition',
    );

    expect(directiveDefinition?.name?.value).toBe(directiveName);
    expect(directiveTypeDef).toMatchSnapshot();
  });
});

describe('createRateLimitDirective', () => {
  const consume = jest.spyOn(RateLimiterMemory.prototype, 'consume');
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
  const resolverValidationOptions: IResolverValidationOptions = {
    requireResolversToMatchSchema: 'ignore',
  };
  beforeEach(() => {
    consume.mockReset();
  });

  it('limits a field', async () => {
    const typeDefs = gql`
      type Query {
        quote: String @rateLimit
      }
    `;
    const schema = makeExecutableSchema({
      typeDefs: [createRateLimitTypeDef(), typeDefs],
      resolvers,
      resolverValidationOptions,
      schemaDirectives: {
        rateLimit: createRateLimitDirective(),
      },
    });

    const response = await graphql(schema, 'query { quote }');

    expect(response).toMatchSnapshot();
    expect(consume).toHaveBeenCalledTimes(1);
    expect(consume).toHaveBeenCalledWith('Query.quote', 1);
  });
  it('limits a repeated field', async () => {
    const typeDefs = gql`
      type Query {
        books: [Book!]
      }
      type Book {
        title: String @rateLimit
      }
    `;
    const schema = makeExecutableSchema({
      typeDefs: [createRateLimitTypeDef(), typeDefs],
      resolvers,
      resolverValidationOptions,
      schemaDirectives: {
        rateLimit: createRateLimitDirective(),
      },
    });

    const response = await graphql(schema, 'query { books { title } }');

    expect(response).toMatchSnapshot();
    expect(consume).toHaveBeenCalledTimes(2);
    expect(consume).toHaveBeenCalledWith('Book.title', 1);
  });
  it('limits an object', async () => {
    const typeDefs = gql`
      type Query @rateLimit {
        books: [Book!]
        quote: String
      }
      type Book {
        title: String
      }
    `;
    const schema = makeExecutableSchema({
      typeDefs: [createRateLimitTypeDef(), typeDefs],
      resolvers,
      resolverValidationOptions,
      schemaDirectives: {
        rateLimit: createRateLimitDirective(),
      },
    });

    const response = await graphql(schema, 'query { quote books { title } }');

    expect(response).toMatchSnapshot();
    expect(consume).toHaveBeenCalledTimes(2);
    expect(consume).toHaveBeenCalledWith('Query.quote', 1);
    expect(consume).toHaveBeenCalledWith('Query.books', 1);
  });
  it('raises limiter error', async () => {
    consume.mockImplementation(() => {
      throw new Error('Some error happened');
    });
    const typeDefs = gql`
      type Query {
        quote: String @rateLimit
      }
    `;
    const schema = makeExecutableSchema({
      typeDefs: [createRateLimitTypeDef(), typeDefs],
      resolvers,
      resolverValidationOptions,
      schemaDirectives: {
        rateLimit: createRateLimitDirective(),
      },
    });

    const response = await graphql(schema, 'query { quote }');

    expect(response).toMatchSnapshot();
    expect(consume).toHaveBeenCalledTimes(1);
    expect(consume).toHaveBeenCalledWith('Query.quote', 1);
  });
  it('uses default onLimit', async () => {
    consume
      .mockResolvedValueOnce({
        msBeforeNext: 250,
        remainingPoints: 0,
        consumedPoints: 1,
        isFirstInDuration: true,
      } as RateLimiterRes)
      .mockRejectedValue({
        msBeforeNext: 250,
        remainingPoints: 0,
        consumedPoints: 1,
        isFirstInDuration: false,
      } as RateLimiterRes);
    const typeDefs = gql`
      type Query {
        quote: String @rateLimit(limit: 1)
      }
    `;
    const schema = makeExecutableSchema({
      typeDefs: [createRateLimitTypeDef(), typeDefs],
      resolvers,
      resolverValidationOptions,
      schemaDirectives: {
        rateLimit: createRateLimitDirective(),
      },
    });

    const response = await graphql(
      schema,
      'query { firstQuote: quote secondQuote: quote }',
    );

    expect(response).toMatchSnapshot();
    expect(consume).toHaveBeenCalledTimes(2);
    expect(consume).toHaveBeenCalledWith('Query.quote', 1);
  });
  it('respects custom async key generator', async () => {
    const typeDefs = gql`
      type Query {
        quote: String @rateLimit(limit: 10, duration: 300)
      }
    `;
    interface IContext {
      ip: string;
    }
    const context: IContext = {
      ip: '127.0 0.1',
    };
    const keyGenerator = (
      directiveArgs: RateLimitArgs,
      obj: unknown,
      args: { [key: string]: unknown },
      context: IContext,
      info: GraphQLResolveInfo,
    ) => {
      expect(directiveArgs.limit).toBe(10);
      expect(directiveArgs.duration).toBe(300);
      // This could be sync, but that case is widely tested already so force this to return a Promise
      return Promise.resolve(
        `${context.ip}:${info.parentType}.${info.fieldName}`,
      );
    };
    const schema = makeExecutableSchema({
      typeDefs: [createRateLimitTypeDef(), typeDefs],
      resolvers,
      resolverValidationOptions,
      schemaDirectives: {
        rateLimit: createRateLimitDirective({ keyGenerator }),
      },
    });

    const response = await graphql(
      schema,
      'query { quote }',
      undefined,
      context,
    );

    expect(response).toMatchSnapshot();
    expect(consume).toHaveBeenCalledTimes(1);
    expect(consume).toHaveBeenCalledWith('127.0 0.1:Query.quote', 1);
  });
  it('uses custom onLimit', async () => {
    const consumeResponse = {
      msBeforeNext: 1250,
      remainingPoints: 0,
      consumedPoints: 10,
      isFirstInDuration: false,
    } as RateLimiterRes;
    consume.mockRejectedValue(consumeResponse);
    const typeDefs = gql`
      type Query {
        quote: String @rateLimit(limit: 10, duration: 300)
      }
    `;
    const onLimit = (
      resource: RateLimiterRes,
      directiveArgs: RateLimitArgs,
      /* eslint-disable @typescript-eslint/no-unused-vars */
      obj: unknown,
      args: { [key: string]: unknown },
      context: Record<string, unknown>,
      info: GraphQLResolveInfo,
      /* eslint-enable @typescript-eslint/no-unused-vars */
    ) => {
      expect(resource).toBe(consumeResponse);
      expect(directiveArgs.limit).toBe(10);
      expect(directiveArgs.duration).toBe(300);
      return 'So comes snow after fire, and even dragons have their endings. ― Bilbo Baggins';
    };
    const schema = makeExecutableSchema({
      typeDefs: [createRateLimitTypeDef(), typeDefs],
      resolvers,
      resolverValidationOptions,
      schemaDirectives: {
        rateLimit: createRateLimitDirective({ onLimit }),
      },
    });

    const response = await graphql(schema, 'query { quote }');

    expect(response).toMatchSnapshot();
    expect(consume).toHaveBeenCalledTimes(1);
    expect(consume).toHaveBeenCalledWith('Query.quote', 1);
  });
  it('uses custom pointsCalculator', async () => {
    const typeDefs = gql`
      type Query {
        quote: String @rateLimit(limit: 10, duration: 300)
      }
    `;
    const pointsCalculator = (
      /* eslint-disable @typescript-eslint/no-unused-vars */
      directiveArgs: RateLimitArgs,
      obj: unknown,
      args: { [key: string]: unknown },
      context: Record<string, unknown>,
      info: GraphQLResolveInfo,
      /* eslint-enable @typescript-eslint/no-unused-vars */
    ) => {
      return 2;
    };
    const schema = makeExecutableSchema({
      typeDefs: [createRateLimitTypeDef(), typeDefs],
      resolvers,
      resolverValidationOptions,
      schemaDirectives: {
        rateLimit: createRateLimitDirective({ pointsCalculator }),
      },
    });

    const response = await graphql(schema, 'query { quote }');

    expect(response).toMatchSnapshot();
    expect(consume).toHaveBeenCalledTimes(1);
    expect(consume).toHaveBeenCalledWith('Query.quote', 2);
  });
  it('skips consume on zero points', async () => {
    const typeDefs = gql`
      type Query {
        quote: String @rateLimit(limit: 10, duration: 300)
      }
    `;
    const pointsCalculator = (
      /* eslint-disable @typescript-eslint/no-unused-vars */
      directiveArgs: RateLimitArgs,
      obj: unknown,
      args: { [key: string]: unknown },
      context: Record<string, unknown>,
      info: GraphQLResolveInfo,
      /* eslint-enable @typescript-eslint/no-unused-vars */
    ) => {
      return 0;
    };
    const schema = makeExecutableSchema({
      typeDefs: [createRateLimitTypeDef(), typeDefs],
      resolvers,
      resolverValidationOptions,
      schemaDirectives: {
        rateLimit: createRateLimitDirective({ pointsCalculator }),
      },
    });

    const response = await graphql(schema, 'query { quote }');

    expect(response).toMatchSnapshot();
    expect(consume).not.toHaveBeenCalled();
  });
  it('respects custom limiter keyPrefix option', async () => {
    const keyPrefix = 'custom';
    class TestRateLimiterMemory extends RateLimiterMemory {
      constructor(opts: IRateLimiterOptions) {
        super(opts);
        expect(opts.keyPrefix).toBe(keyPrefix);
      }
    }
    const typeDefs = gql`
      type Query {
        quote: String @rateLimit
      }
    `;
    const schema = makeExecutableSchema({
      typeDefs: [createRateLimitTypeDef(), typeDefs],
      resolvers,
      resolverValidationOptions,
      schemaDirectives: {
        rateLimit: createRateLimitDirective({
          limiterClass: TestRateLimiterMemory,
          limiterOptions: { keyPrefix },
        }),
      },
    });

    await graphql(schema, 'query { quote }');
  });
});
