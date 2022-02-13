import {
  defaultFieldResolver,
  GraphQLError,
  GraphQLField,
  GraphQLFieldConfig,
  GraphQLResolveInfo,
  GraphQLSchema,
} from 'graphql';
import { getDirective, mapSchema, MapperKind } from '@graphql-tools/utils';
import {
  IRateLimiterOptions,
  RateLimiterAbstract,
  RateLimiterMemory,
  RateLimiterRes,
} from 'rate-limiter-flexible';

type MaybePromise<T> = Promise<T> | T;

type GraphQLFieldUnion =
  | GraphQLField<unknown, unknown, { [key: string]: unknown }>
  | GraphQLFieldConfig<unknown, unknown, { [argName: string]: unknown }>;

/**
 * Configure rate limit field behaviour.
 */
export type RateLimitArgs = {
  /**
   * Number of occurrences allowed over duration.
   */
  limit: number;
  /**
   * Number of seconds before limit is reset.
   */
  duration: number;
};

export type RateLimitKeyGenerator<TContext> = (
  directiveArgs: RateLimitArgs,
  source: unknown,
  args: { [key: string]: unknown },
  context: TContext,
  info: GraphQLResolveInfo,
) => MaybePromise<string>;

export type RateLimitPointsCalculator<TContext> = (
  directiveArgs: RateLimitArgs,
  source: unknown,
  args: { [key: string]: unknown },
  context: TContext,
  info: GraphQLResolveInfo,
) => MaybePromise<number>;

export type RateLimitOnLimit<TContext> = (
  response: RateLimiterRes,
  directiveArgs: RateLimitArgs,
  source: unknown,
  args: { [key: string]: unknown },
  context: TContext,
  info: GraphQLResolveInfo,
) => MaybePromise<unknown>;

export type RateLimitSetState<TContext> = (
  response: RateLimiterRes,
  directiveArgs: RateLimitArgs,
  source: unknown,
  args: { [key: string]: unknown },
  context: TContext,
  info: GraphQLResolveInfo,
) => void;

/**
 * Configure rate limit behaviour.
 */
export interface RateLimitOptions<TContext> {
  /**
   * Name of the directive.
   */
  name?: string;
  /**
   * Default value for argument limit.
   */
  defaultLimit?: string;
  /**
   * Default value for argument duration.
   */
  defaultDuration?: string;
  /**
   * Constructs a key to represent an operation on a field.
   */
  keyGenerator?: RateLimitKeyGenerator<TContext>;
  /**
   * Calculate the number of points to consume.
   */
  pointsCalculator?: RateLimitPointsCalculator<TContext>;
  /**
   * Behaviour when limit is exceeded.
   */
  onLimit?: RateLimitOnLimit<TContext>;
  /**
   * If rate limiter information for request should be stored in context, how to record it.
   */
  setState?: RateLimitSetState<TContext>;
  /**
   * An implementation of a limiter.
   */
  limiterClass?: typeof RateLimiterAbstract;
  /**
   * Configuration to apply to created limiters.
   */
  limiterOptions?: Pick<
    IRateLimiterOptions,
    Exclude<keyof IRateLimiterOptions, keyof { points?: number; duration?: number }>
  >;
}

/**
 * Implementation of a rate limit schema directive.
 */
export interface RateLimitDirective {
  /**
   * Schema Definition Language (SDL) representation of the directive.
   */
  rateLimitDirectiveTypeDefs: string;
  /**
   * Function to apply the directive's logic to the provided schema.
   */
  rateLimitDirectiveTransformer: (schema: GraphQLSchema) => GraphQLSchema;
}

/**
 * Convert milliseconds to seconds.
 * @param duration Milliseconds.
 */
export function millisecondsToSeconds(duration: number): number {
  return Math.ceil(duration / 1000); // round up to over estimate for client
}

/**
 * Human readable string that uniquely identifies a schema element within a GraphQL Schema.
 * @param info Holds field-specific information relevant to the current operation as well as the schema details.
 */
export function getSchemaCoordinate(info: GraphQLResolveInfo): string {
  return `${info.parentType.name}.${info.fieldName}`;
}

/**
 * Get a value to uniquely identify a field in a schema.
 * @param directiveArgs The arguments defined in the schema for the directive.
 * @param source The previous result returned from the resolver on the parent field.
 * @param args The arguments provided to the field in the GraphQL operation.
 * @param context Contains per-request state shared by all resolvers in a particular operation.
 * @param info Holds field-specific information relevant to the current operation as well as the schema details.
 */
export function defaultKeyGenerator<TContext>(
  directiveArgs: RateLimitArgs,
  source: unknown,
  args: { [key: string]: unknown },
  context: TContext,
  info: GraphQLResolveInfo,
): string {
  return getSchemaCoordinate(info);
}

/**
 * Calculate the number of points to consume.
 * @param directiveArgs The arguments defined in the schema for the directive.
 * @param source The previous result returned from the resolver on the parent field.
 * @param args The arguments provided to the field in the GraphQL operation.
 * @param context Contains per-request state shared by all resolvers in a particular operation.
 * @param info Holds field-specific information relevant to the current operation as well as the schema details.
 */
export function defaultPointsCalculator<TContext>(
  /* eslint-disable @typescript-eslint/no-unused-vars */
  directiveArgs: RateLimitArgs,
  source: unknown,
  args: { [key: string]: unknown },
  context: TContext,
  info: GraphQLResolveInfo,
  /* eslint-enable @typescript-eslint/no-unused-vars */
): number {
  return 1;
}

/**
 * Raise a rate limit error when there are too many requests.
 * @param response The current rate limit information for this field.
 * @param directiveArgs The arguments defined in the schema for the directive.
 * @param source The previous result returned from the resolver on the parent field.
 * @param args The arguments provided to the field in the GraphQL operation.
 * @param context Contains per-request state shared by all resolvers in a particular operation.
 * @param info Holds field-specific information relevant to the current operation as well as the schema details.
 */
export function defaultOnLimit<TContext>(
  response: RateLimiterRes,
  /* eslint-disable @typescript-eslint/no-unused-vars */
  directiveArgs: RateLimitArgs,
  source: unknown,
  args: { [key: string]: unknown },
  context: TContext,
  info: GraphQLResolveInfo,
  /* eslint-enable @typescript-eslint/no-unused-vars */
): unknown {
  throw new GraphQLError(
    `Too many requests, please try again in ${millisecondsToSeconds(
      response.msBeforeNext,
    )} seconds.`,
  );
}

/**
 * Write directive state into context.
 * @param name Key of rate limit state in context, likely the directive's name.
 */
export function defaultSetState<TContext>(name = 'rateLimit'): RateLimitSetState<TContext> {
  return (response, directiveArgs, source, args, context, info) => {
    let state = context[name];
    if (!state) {
      state = {};
      context[name] = state;
    }
    state[getSchemaCoordinate(info)] = response;
  };
}

/**
 * Create an implementation of a rate limit directive.
 */
export function rateLimitDirective<TContext>({
  name = 'rateLimit',
  defaultLimit = '60',
  defaultDuration = '60',
  keyGenerator = defaultKeyGenerator,
  pointsCalculator = defaultPointsCalculator,
  onLimit = defaultOnLimit,
  setState,
  limiterClass = RateLimiterMemory,
  limiterOptions = {},
}: RateLimitOptions<TContext> = {}): RateLimitDirective {
  const limiters = new Map<string, RateLimiterAbstract>();
  const getLimiter = ({ limit, duration }: RateLimitArgs): RateLimiterAbstract => {
    const limiterKey = `${limit}/${duration}s`;
    let limiter = limiters.get(limiterKey);
    if (limiter === undefined) {
      limiter = new limiterClass({
        ...limiterOptions,
        keyPrefix:
          limiterOptions.keyPrefix === undefined
            ? name // change the default behaviour which is to use 'rlflx'
            : limiterOptions.keyPrefix,
        points: limit,
        duration: duration,
      });
      limiters.set(limiterKey, limiter);
    }
    return limiter;
  };
  const rateLimit = (directive: Record<string, unknown>, field: GraphQLFieldUnion): void => {
    const directiveArgs = directive as RateLimitArgs;
    const limiter = getLimiter(directiveArgs);
    const { resolve = defaultFieldResolver } = field;
    field.resolve = async (source, args, context: TContext, info) => {
      const pointsToConsume = await pointsCalculator(directiveArgs, source, args, context, info);
      if (pointsToConsume !== 0) {
        const key = await keyGenerator(directiveArgs, source, args, context, info);
        try {
          const response = await limiter.consume(key, pointsToConsume);
          if (setState) setState(response, directiveArgs, source, args, context, info);
        } catch (e) {
          if (e instanceof Error) {
            throw e;
          }

          const response = e as RateLimiterRes;
          if (setState) setState(response, directiveArgs, source, args, context, info);
          return onLimit(response, directiveArgs, source, args, context, info);
        }
      }
      return resolve(source, args, context, info);
    };
  };

  return {
    rateLimitDirectiveTypeDefs: `"""
Controls the rate of traffic.
"""
directive @${name}(
  """
  Number of occurrences allowed over duration.
  """
  limit: Int! = ${defaultLimit}

  """
  Number of seconds before limit is reset.
  """
  duration: Int! = ${defaultDuration}
) on OBJECT | FIELD_DEFINITION`,
    rateLimitDirectiveTransformer: (schema) =>
      mapSchema(schema, {
        [MapperKind.OBJECT_TYPE]: (type, schema) => {
          const rateLimitDirective = getDirective(schema, type, name)?.[0];
          if (rateLimitDirective) {
            // Wrap fields of object for limiting that don't have their own directive applied
            const fields = type.getFields();
            Object.values(fields).forEach((field) => {
              const overrideDirective = getDirective(schema, field, name);
              if (overrideDirective === undefined) {
                rateLimit(rateLimitDirective, field);
              }
            });
          }
          return type;
        },
        [MapperKind.OBJECT_FIELD]: (fieldConfig, fieldName, typeName, schema) => {
          const rateLimitDirective = getDirective(schema, fieldConfig, name)?.[0];
          if (rateLimitDirective) {
            rateLimit(rateLimitDirective, fieldConfig);
          }
          return fieldConfig;
        },
      }),
  };
}
