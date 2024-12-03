import { makeExecutableSchema } from '@graphql-tools/schema';
import { IResolverValidationOptions } from '@graphql-tools/utils';
import {
  graphql,
  ExecutionResult,
  GraphQLDirective,
  GraphQLError,
  GraphQLResolveInfo,
  GraphQLSchema,
} from 'graphql';
import { IRateLimiterOptions, RateLimiterMemory, RateLimiterRes } from 'rate-limiter-flexible';
import { defaultSetState, rateLimitDirective, RateLimitArgs } from '../index';

type TestContext = Record<string, unknown>;

const getDirective = (schema: GraphQLSchema, name = 'rateLimit'): GraphQLDirective => {
  const directive = schema.getDirectives().find((directive) => directive.name == name);
  expect(directive).toBeDefined();
  // See https://github.com/DefinitelyTyped/DefinitelyTyped/issues/41179
  return directive!;
};

const getError = (response: ExecutionResult): GraphQLError => {
  const error = (response.errors || [])[0];
  expect(error).toBeDefined();
  return error;
};

describe('rateLimitDirective', () => {
  it('creates custom named directive', () => {
    const name = 'customRateLimit';

    const { rateLimitDirectiveTypeDefs, rateLimitDirectiveTransformer } = rateLimitDirective({
      name,
    });
    const schema = rateLimitDirectiveTransformer(
      makeExecutableSchema({
        typeDefs: [rateLimitDirectiveTypeDefs, ``],
      }),
    );

    expect(getDirective(schema, name)).toEqual(expect.objectContaining({ name }));
  });

  it('overrides limit argument default value', () => {
    const defaultLimit = '30';

    const { rateLimitDirectiveTypeDefs, rateLimitDirectiveTransformer } = rateLimitDirective({
      defaultLimit,
    });
    const schema = rateLimitDirectiveTransformer(
      makeExecutableSchema({
        typeDefs: [rateLimitDirectiveTypeDefs, ``],
      }),
    );

    expect(getDirective(schema).args).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'limit', defaultValue: 30 })]),
    );
  });

  it('overrides duration argument default value', () => {
    const defaultDuration = '30';

    const { rateLimitDirectiveTypeDefs, rateLimitDirectiveTransformer } = rateLimitDirective({
      defaultDuration,
    });
    const schema = rateLimitDirectiveTransformer(
      makeExecutableSchema({
        typeDefs: [rateLimitDirectiveTypeDefs, ``],
      }),
    );

    expect(getDirective(schema).args).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'duration', defaultValue: 30 })]),
    );
  });

  it('uses custom limiter class with keyPrefix option', async () => {
    let ranConstructor = false;
    const keyPrefix = 'custom';
    class CustomRateLimiter extends RateLimiterMemory {
      constructor(opts: IRateLimiterOptions) {
        super(opts);
        ranConstructor = true;
        expect(opts.keyPrefix).toEqual(keyPrefix);
      }
    }

    const { rateLimitDirectiveTypeDefs, rateLimitDirectiveTransformer } = rateLimitDirective({
      limiterClass: CustomRateLimiter,
      limiterOptions: { keyPrefix },
    });
    const schema = rateLimitDirectiveTransformer(
      makeExecutableSchema({
        typeDefs: [
          rateLimitDirectiveTypeDefs,
          `type Query {
            quote: String @rateLimit
          }`,
        ],
      }),
    );

    await graphql({ schema, source: 'query { quote }' });

    expect(ranConstructor).toEqual(true);
  });

  describe('limiting', () => {
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
    let limiterConsume;
    beforeEach(() => {
      limiterConsume = jest.spyOn(RateLimiterMemory.prototype, 'consume');
    });
    afterEach(() => {
      limiterConsume.mockRestore();
    });

    it('a specific field', async () => {
      const { rateLimitDirectiveTypeDefs, rateLimitDirectiveTransformer } = rateLimitDirective();
      const schema = rateLimitDirectiveTransformer(
        makeExecutableSchema({
          typeDefs: [
            rateLimitDirectiveTypeDefs,
            `type Query {
              quote: String @rateLimit
            }`,
          ],
          resolvers,
          resolverValidationOptions,
        }),
      );

      const response = await graphql({ schema, source: 'query { quote }' });

      expect(limiterConsume).toHaveBeenCalledTimes(1);
      expect(limiterConsume).toHaveBeenCalledWith('Query.quote', 1);
      expect(response).toMatchSnapshot();
    });

    it('a repeated object', async () => {
      const { rateLimitDirectiveTypeDefs, rateLimitDirectiveTransformer } = rateLimitDirective();
      const schema = rateLimitDirectiveTransformer(
        makeExecutableSchema({
          typeDefs: [
            rateLimitDirectiveTypeDefs,
            `type Query {
              books: [Book!]
            }
            type Book {
              title: String @rateLimit
            }`,
          ],
          resolvers,
          resolverValidationOptions,
        }),
      );

      const response = await graphql({ schema, source: 'query { books { title } }' });

      expect(limiterConsume).toHaveBeenCalledTimes(2);
      expect(limiterConsume).toHaveBeenNthCalledWith(1, 'Book.title', 1);
      expect(limiterConsume).toHaveBeenNthCalledWith(2, 'Book.title', 1);
      expect(response).toMatchSnapshot();
    });

    it('each field of an object', async () => {
      const { rateLimitDirectiveTypeDefs, rateLimitDirectiveTransformer } = rateLimitDirective();
      const schema = rateLimitDirectiveTransformer(
        makeExecutableSchema({
          typeDefs: [
            rateLimitDirectiveTypeDefs,
            `type Query @rateLimit {
              books: [Book!]
              quote: String
            }
            type Book {
              title: String
            }`,
          ],
          resolvers,
          resolverValidationOptions,
        }),
      );

      const response = await graphql({ schema, source: 'query { quote books { title } }' });

      expect(limiterConsume).toHaveBeenCalledTimes(2);
      expect(limiterConsume).toHaveBeenCalledWith('Query.quote', 1);
      expect(limiterConsume).toHaveBeenCalledWith('Query.books', 1);
      expect(response).toMatchSnapshot();
    });

    it('overrides field of an object', async () => {
      const { rateLimitDirectiveTypeDefs, rateLimitDirectiveTransformer } = rateLimitDirective();
      const schema = rateLimitDirectiveTransformer(
        makeExecutableSchema({
          typeDefs: [
            rateLimitDirectiveTypeDefs,
            `type Query  {
              books: [Book!]
            }
            type Book @rateLimit {
              title: String
              author: String @rateLimit(limit: 1)
            }`,
          ],
          resolvers,
          resolverValidationOptions,
        }),
      );

      const response = await graphql({ schema, source: 'query { books { title author } }' });

      expect(limiterConsume).toHaveBeenCalledTimes(4);
      expect(limiterConsume).toHaveBeenCalledWith('Book.title', 1);
      expect(limiterConsume).toHaveBeenCalledWith('Book.author', 1);

      const error = getError(response);
      expect(error.message).toMatch(/Too many requests, please try again in \d+ seconds\./);
      expect(error.path).toEqual(['books', expect.any(Number), 'author']);
    });

    it('reraises limiter error', async () => {
      const message = 'Some error happened';
      limiterConsume.mockImplementation(() => {
        throw new Error(message);
      });

      const { rateLimitDirectiveTypeDefs, rateLimitDirectiveTransformer } = rateLimitDirective();
      const schema = rateLimitDirectiveTransformer(
        makeExecutableSchema({
          typeDefs: [
            rateLimitDirectiveTypeDefs,
            `type Query {
              quote: String @rateLimit
            }`,
          ],
          resolvers,
          resolverValidationOptions,
        }),
      );

      const response = await graphql({ schema, source: 'query { quote }' });

      expect(limiterConsume).toHaveBeenCalledTimes(1);
      expect(limiterConsume).toHaveBeenCalledWith('Query.quote', 1);

      const error = getError(response);
      expect(error.message).toEqual(message);
      expect(error.path).toEqual(['quote']);
    });

    it('skips consume on zero cost', async () => {
      const pointsCalculator = jest.fn(
        (
          /* eslint-disable @typescript-eslint/no-unused-vars */
          directiveArgs: RateLimitArgs,
          obj: unknown,
          args: { [key: string]: unknown },
          context: TestContext,
          info: GraphQLResolveInfo,
          /* eslint-enable @typescript-eslint/no-unused-vars */
        ) => 0,
      );

      const { rateLimitDirectiveTypeDefs, rateLimitDirectiveTransformer } = rateLimitDirective({
        pointsCalculator,
      });
      const schema = rateLimitDirectiveTransformer(
        makeExecutableSchema({
          typeDefs: [
            rateLimitDirectiveTypeDefs,
            `type Query {
              quote: String @rateLimit
            }`,
          ],
          resolvers,
          resolverValidationOptions,
        }),
      );

      await graphql({ schema, source: 'query { quote }' });

      expect(pointsCalculator).toHaveBeenCalled();
      expect(limiterConsume).not.toHaveBeenCalled();
    });

    it('uses default onLimit', async () => {
      limiterConsume
        .mockResolvedValueOnce(<RateLimiterRes>{
          msBeforeNext: 250,
          remainingPoints: 0,
          consumedPoints: 1,
          isFirstInDuration: true,
        })
        .mockRejectedValue(<RateLimiterRes>{
          msBeforeNext: 250,
          remainingPoints: 0,
          consumedPoints: 1,
          isFirstInDuration: false,
        });

      const { rateLimitDirectiveTypeDefs, rateLimitDirectiveTransformer } = rateLimitDirective();
      const schema = rateLimitDirectiveTransformer(
        makeExecutableSchema({
          typeDefs: [
            rateLimitDirectiveTypeDefs,
            `type Query {
              quote: String @rateLimit(limit: 1)
            }`,
          ],
          resolvers,
          resolverValidationOptions,
        }),
      );

      const response = await graphql({
        schema,
        source: 'query { firstQuote: quote secondQuote: quote }',
      });

      expect(limiterConsume).toHaveBeenCalledTimes(2);
      expect(limiterConsume).toHaveBeenCalledWith('Query.quote', 1);

      const error = getError(response);
      expect(error.message).toMatch(/Too many requests, please try again in \d+ seconds\./);
      expect(error.path).toEqual([expect.any(String)]);
    });

    describe('default override', () => {
      it('uses custom keyGenerator', async () => {
        interface Context {
          ip: string;
        }
        const contextValue: Context = {
          ip: '127.0 0.1',
        };
        const keyGenerator = jest.fn(
          (
            directiveArgs: RateLimitArgs,
            obj: unknown,
            args: { [key: string]: unknown },
            context: Context,
            info: GraphQLResolveInfo,
          ) => {
            // This could be sync, but that case is widely tested already so force this to return a Promise
            return Promise.resolve(`${context.ip}:${info.parentType}.${info.fieldName}`);
          },
        );

        const { rateLimitDirectiveTypeDefs, rateLimitDirectiveTransformer } = rateLimitDirective({
          keyGenerator,
        });
        const schema = rateLimitDirectiveTransformer(
          makeExecutableSchema({
            typeDefs: [
              rateLimitDirectiveTypeDefs,
              `type Query {
                quote: String @rateLimit(limit: 10, duration: 300)
              }`,
            ],
            resolvers,
            resolverValidationOptions,
          }),
        );

        const response = await graphql({ schema, source: 'query { quote }', contextValue });

        expect(keyGenerator).toHaveBeenCalledWith(
          { limit: 10, duration: 300 },
          undefined,
          {},
          contextValue,
          expect.any(Object),
        );
        expect(limiterConsume).toHaveBeenCalledTimes(1);
        expect(limiterConsume).toHaveBeenCalledWith('127.0 0.1:Query.quote', 1);
        expect(response).toMatchSnapshot();
      });

      it('uses custom pointsCalculator', async () => {
        const pointsCalculator = jest.fn(
          (
            /* eslint-disable @typescript-eslint/no-unused-vars */
            directiveArgs: RateLimitArgs,
            obj: unknown,
            args: { [key: string]: unknown },
            context: TestContext,
            info: GraphQLResolveInfo,
            /* eslint-enable @typescript-eslint/no-unused-vars */
          ) => 2,
        );

        const { rateLimitDirectiveTypeDefs, rateLimitDirectiveTransformer } = rateLimitDirective({
          pointsCalculator,
        });
        const schema = rateLimitDirectiveTransformer(
          makeExecutableSchema({
            typeDefs: [
              rateLimitDirectiveTypeDefs,
              `type Query {
                quote: String @rateLimit(limit: 10, duration: 300)
              }`,
            ],
            resolvers,
            resolverValidationOptions,
          }),
        );

        const response = await graphql({ schema, source: 'query { quote }' });

        expect(pointsCalculator).toHaveBeenCalledWith(
          { limit: 10, duration: 300 },
          undefined,
          {},
          undefined,
          expect.any(Object),
        );
        expect(limiterConsume).toHaveBeenCalledTimes(1);
        expect(limiterConsume).toHaveBeenCalledWith('Query.quote', 2);
        expect(response).toMatchSnapshot();
      });

      it('uses custom onLimit', async () => {
        const consumeResponse = <RateLimiterRes>{
          msBeforeNext: 1250,
          remainingPoints: 0,
          consumedPoints: 10,
          isFirstInDuration: false,
        };
        limiterConsume.mockRejectedValue(consumeResponse);
        const onLimit = jest.fn(
          (
            /* eslint-disable @typescript-eslint/no-unused-vars */
            resource: RateLimiterRes,
            directiveArgs: RateLimitArgs,
            obj: unknown,
            args: { [key: string]: unknown },
            context: TestContext,
            info: GraphQLResolveInfo,
            /* eslint-enable @typescript-eslint/no-unused-vars */
          ) => 'So comes snow after fire, and even dragons have their endings. ― Bilbo Baggins',
        );

        const { rateLimitDirectiveTypeDefs, rateLimitDirectiveTransformer } = rateLimitDirective({
          onLimit,
        });
        const schema = rateLimitDirectiveTransformer(
          makeExecutableSchema({
            typeDefs: [
              rateLimitDirectiveTypeDefs,
              `type Query {
                quote: String @rateLimit(limit: 10, duration: 300)
              }`,
            ],
            resolvers,
            resolverValidationOptions,
          }),
        );

        const response = await graphql({ schema, source: 'query { quote }' });

        expect(limiterConsume).toHaveBeenCalledTimes(1);
        expect(limiterConsume).toHaveBeenCalledWith('Query.quote', 1);
        expect(onLimit).toHaveBeenCalledWith(
          consumeResponse,
          { limit: 10, duration: 300 },
          undefined,
          {},
          undefined,
          expect.any(Object),
        );
        expect(response).toMatchSnapshot();
      });

      it('stores state in context', async () => {
        const directiveName = 'rateLimit';
        interface Context {
          [directiveName]?: {
            [coordinate: string]: RateLimiterRes;
          };
        }
        const contextValue: Context = {};

        const { rateLimitDirectiveTypeDefs, rateLimitDirectiveTransformer } =
          rateLimitDirective<Context>({
            setState: defaultSetState(directiveName),
          });
        const schema = rateLimitDirectiveTransformer(
          makeExecutableSchema({
            typeDefs: [
              rateLimitDirectiveTypeDefs,
              `type Query  {
                books: [Book!]
                quote: String @rateLimit(limit: 3)
              }
              type Book {
                title: String
                author: String @rateLimit(limit: 3)
              }`,
            ],
            resolvers,
            resolverValidationOptions,
          }),
        );

        await graphql({ schema, source: 'query { quote books { title author } }', contextValue });
        const state = contextValue[directiveName];

        expect(state).toEqual({
          'Query.quote': expect.objectContaining({
            consumedPoints: 1,
            remainingPoints: 2,
          }),
          'Book.author': expect.objectContaining({
            consumedPoints: 2,
            remainingPoints: 1,
          }),
        });
      });
    });

    describe('field extension override', () => {
      const directiveName = 'rateLimit';
      const resolvers = {
        Query: {
          quote: {
            resolve: () =>
              'The future is something which everyone reaches at the rate of sixty minutes an hour, whatever he does, whoever he is. ― C.S. Lewis',
            extensions: {},
          },
        },
      };

      it('uses custom keyGenerator', async () => {
        const keyGenerator = jest.fn(
          (
            directiveArgs: RateLimitArgs,
            obj: unknown,
            args: { [key: string]: unknown },
            context: TestContext,
            info: GraphQLResolveInfo,
          ) => {
            // This could be sync, but that case is widely tested already so force this to return a Promise
            return Promise.resolve(`CUSTOM:${info.parentType}.${info.fieldName}`);
          },
        );
        const { rateLimitDirectiveTypeDefs, rateLimitDirectiveTransformer } =
          rateLimitDirective<TestContext>({
            name: directiveName,
          });
        resolvers.Query.quote.extensions[directiveName] = {
          keyGenerator,
        };

        const schema = rateLimitDirectiveTransformer(
          makeExecutableSchema({
            typeDefs: [
              rateLimitDirectiveTypeDefs,
              `type Query {
                quote: String @rateLimit(limit: 10, duration: 300)
              }`,
            ],
            resolvers,
            resolverValidationOptions,
          }),
        );

        const response = await graphql({ schema, source: 'query { quote }' });

        expect(keyGenerator).toHaveBeenCalledWith(
          { limit: 10, duration: 300 },
          undefined,
          {},
          undefined,
          expect.any(Object),
        );
        expect(limiterConsume).toHaveBeenCalledTimes(1);
        expect(limiterConsume).toHaveBeenCalledWith('CUSTOM:Query.quote', 1);
        expect(response).toMatchSnapshot();
      });

      it('uses custom pointsCalculator', async () => {
        const pointsCalculator = jest.fn(
          (
            /* eslint-disable @typescript-eslint/no-unused-vars */
            directiveArgs: RateLimitArgs,
            obj: unknown,
            args: { [key: string]: unknown },
            context: TestContext,
            info: GraphQLResolveInfo,
            /* eslint-enable @typescript-eslint/no-unused-vars */
          ) => 2,
        );
        const { rateLimitDirectiveTypeDefs, rateLimitDirectiveTransformer } =
          rateLimitDirective<TestContext>({
            name: directiveName,
          });
        resolvers.Query.quote.extensions[directiveName] = {
          pointsCalculator,
        };

        const schema = rateLimitDirectiveTransformer(
          makeExecutableSchema({
            typeDefs: [
              rateLimitDirectiveTypeDefs,
              `type Query {
                quote: String @rateLimit(limit: 10, duration: 300)
              }`,
            ],
            resolvers,
            resolverValidationOptions,
          }),
        );

        const response = await graphql({ schema, source: 'query { quote }' });

        expect(pointsCalculator).toHaveBeenCalledWith(
          { limit: 10, duration: 300 },
          undefined,
          {},
          undefined,
          expect.any(Object),
        );
        expect(limiterConsume).toHaveBeenCalledTimes(1);
        expect(limiterConsume).toHaveBeenCalledWith('Query.quote', 2);
        expect(response).toMatchSnapshot();
      });

      it('uses custom onLimit', async () => {
        const consumeResponse = <RateLimiterRes>{
          msBeforeNext: 1250,
          remainingPoints: 0,
          consumedPoints: 10,
          isFirstInDuration: false,
        };
        limiterConsume.mockRejectedValue(consumeResponse);
        const onLimit = jest.fn(
          (
            /* eslint-disable @typescript-eslint/no-unused-vars */
            resource: RateLimiterRes,
            directiveArgs: RateLimitArgs,
            obj: unknown,
            args: { [key: string]: unknown },
            context: TestContext,
            info: GraphQLResolveInfo,
            /* eslint-enable @typescript-eslint/no-unused-vars */
          ) => 'So comes snow after fire, and even dragons have their endings. ― Bilbo Baggins',
        );
        const { rateLimitDirectiveTypeDefs, rateLimitDirectiveTransformer } =
          rateLimitDirective<TestContext>({
            name: directiveName,
          });
        resolvers.Query.quote.extensions[directiveName] = {
          onLimit,
        };

        const schema = rateLimitDirectiveTransformer(
          makeExecutableSchema({
            typeDefs: [
              rateLimitDirectiveTypeDefs,
              `type Query {
                quote: String @rateLimit(limit: 10, duration: 300)
              }`,
            ],
            resolvers,
            resolverValidationOptions,
          }),
        );

        const response = await graphql({ schema, source: 'query { quote }' });

        expect(limiterConsume).toHaveBeenCalledTimes(1);
        expect(limiterConsume).toHaveBeenCalledWith('Query.quote', 1);
        expect(onLimit).toHaveBeenCalledWith(
          consumeResponse,
          { limit: 10, duration: 300 },
          undefined,
          {},
          undefined,
          expect.any(Object),
        );
        expect(response).toMatchSnapshot();
      });

      it('stores state in context', async () => {
        interface Context {
          [directiveName]?: {
            [coordinate: string]: RateLimiterRes;
          };
        }
        const contextValue: Context = {};
        const { rateLimitDirectiveTypeDefs, rateLimitDirectiveTransformer } =
          rateLimitDirective<Context>({
            name: directiveName,
          });
        resolvers.Query.quote.extensions[directiveName] = {
          setState: defaultSetState(directiveName),
        };

        const schema = rateLimitDirectiveTransformer(
          makeExecutableSchema({
            typeDefs: [
              rateLimitDirectiveTypeDefs,
              `type Query {
                quote: String @rateLimit(limit: 10, duration: 300)
              }`,
            ],
            resolvers,
            resolverValidationOptions,
          }),
        );

        await graphql({ schema, source: 'query { quote }', contextValue });
        const state = contextValue[directiveName];

        expect(state).toEqual({
          'Query.quote': expect.objectContaining({
            consumedPoints: 1,
            remainingPoints: 9,
          }),
        });
      });
    });
  });
});
