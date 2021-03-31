import {
  defaultFieldResolver,
  DocumentNode,
  GraphQLField,
  GraphQLObjectType,
  GraphQLResolveInfo,
  GraphQLError,
} from 'graphql';
import gql from 'graphql-tag';
import { SchemaDirectiveVisitor } from 'graphql-tools';
import {
  IRateLimiterOptions,
  RateLimiterAbstract,
  RateLimiterMemory,
  RateLimiterRes,
} from 'rate-limiter-flexible';

/**
 * Configure rate limit field behaviour.
 */
export interface RateLimitArgs {
  /**
   * Number of occurrences allowed over duration.
   */
  limit: number;
  /**
   * Number of seconds before limit is reset.
   */
  duration: number;
}

export type RateLimitKeyGenerator<TContext> = (
  directiveArgs: RateLimitArgs,
  obj: unknown,
  args: { [key: string]: unknown },
  context: TContext,
  info: GraphQLResolveInfo,
) => Promise<string> | string;

export type RateLimitPointsCalculator<TContext> = (
  directiveArgs: RateLimitArgs,
  obj: unknown,
  args: { [key: string]: unknown },
  context: TContext,
  info: GraphQLResolveInfo,
) => Promise<number> | number;

export type RateLimitOnLimit<TContext> = (
  resource: RateLimiterRes,
  directiveArgs: RateLimitArgs,
  obj: unknown,
  args: { [key: string]: unknown },
  context: TContext,
  info: GraphQLResolveInfo,
) => unknown;

/**
 * Configure rate limit behaviour.
 */
export interface IOptions<TContext> {
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
   * An implementation of a limiter.
   */
  limiterClass?: typeof RateLimiterAbstract;
  /**
   * Configuration to apply to created limiters.
   */
  limiterOptions?: Pick<
    IRateLimiterOptions,
    Exclude<
      keyof IRateLimiterOptions,
      keyof { points?: number; duration?: number }
    >
  >;
}

/**
 * Get a value to uniquely identify a field in a schema.
 * @param directiveArgs The arguments defined in the schema for the directive.
 * @param obj The previous result returned from the resolver on the parent field.
 * @param args The arguments provided to the field in the GraphQL operation.
 * @param context Contains per-request state shared by all resolvers in a particular operation.
 * @param info Holds field-specific information relevant to the current operation as well as the schema details.
 */
export function defaultKeyGenerator<TContext>(
  directiveArgs: RateLimitArgs,
  obj: unknown,
  args: { [key: string]: unknown },
  context: TContext,
  info: GraphQLResolveInfo,
): string {
  return `${info.parentType.name}.${info.fieldName}`;
}

/**
 * Calculate the number of points to consume.
 * @param directiveArgs The arguments defined in the schema for the directive.
 * @param obj The previous result returned from the resolver on the parent field.
 * @param args The arguments provided to the field in the GraphQL operation.
 * @param context Contains per-request state shared by all resolvers in a particular operation.
 * @param info Holds field-specific information relevant to the current operation as well as the schema details.
 */
export function defaultPointsCalculator<TContext>(
  /* eslint-disable @typescript-eslint/no-unused-vars */
  directiveArgs: RateLimitArgs,
  obj: unknown,
  args: { [key: string]: unknown },
  context: TContext,
  info: GraphQLResolveInfo,
  /* eslint-enable @typescript-eslint/no-unused-vars */
): number {
  return 1;
}

/**
 * Raise a rate limit error when there are too many requests.
 * @param resource The current rate limit information for this field.
 * @param directiveArgs The arguments defined in the schema for the directive.
 * @param obj The previous result returned from the resolver on the parent field.
 * @param args The arguments provided to the field in the GraphQL operation.
 * @param context Contains per-request state shared by all resolvers in a particular operation.
 * @param info Holds field-specific information relevant to the current operation as well as the schema details.
 */
export function defaultOnLimit<TContext>(
  resource: RateLimiterRes,
  /* eslint-disable @typescript-eslint/no-unused-vars */
  directiveArgs: RateLimitArgs,
  obj: unknown,
  args: { [key: string]: unknown },
  context: TContext,
  info: GraphQLResolveInfo,
  /* eslint-enable @typescript-eslint/no-unused-vars */
): unknown {
  throw new GraphQLError(
    `Too many requests, please try again in ${Math.ceil(
      resource.msBeforeNext / 1000,
    )} seconds.`,
  );
}

/**
 * Create a GraphQL directive type definition.
 * @param directiveName Name of the directive
 */
export function createRateLimitTypeDef(
  directiveName = 'rateLimit',
): DocumentNode {
  return gql`
  """
  Controls the rate of traffic.
  """
  directive @${directiveName}(
    """
    Number of occurrences allowed over duration.
    """
    limit: Int! = 60

    """
    Number of seconds before limit is reset.
    """
    duration: Int! = 60
  ) on OBJECT | FIELD_DEFINITION
`;
}

/**
 * Create an implementation of a rate limit directive.
 */
export function createRateLimitDirective<TContext>({
  keyGenerator = defaultKeyGenerator,
  pointsCalculator = defaultPointsCalculator,
  onLimit = defaultOnLimit,
  limiterClass = RateLimiterMemory,
  limiterOptions = {},
}: IOptions<TContext> = {}): typeof SchemaDirectiveVisitor {
  const limiters = new Map<string, RateLimiterAbstract>();
  const limiterKeyGenerator = ({ limit, duration }: RateLimitArgs): string =>
    `${limit}/${duration}s`;

  return class extends SchemaDirectiveVisitor {
    public readonly args: RateLimitArgs;

    // Use createRateLimitTypeDef until graphql-tools fixes getDirectiveDeclaration
    // public static getDirectiveDeclaration(
    //   directiveName: string,
    //   schema: GraphQLSchema,
    // ): GraphQLDirective {
    //   return new GraphQLDirective({
    //     name: directiveName,
    //     description: 'Controls the rate of traffic.',
    //     locations: [
    //       DirectiveLocation.FIELD_DEFINITION,
    //       DirectiveLocation.OBJECT,
    //     ],
    //     args: {
    //       limit: {
    //         type: GraphQLNonNull(GraphQLInt),
    //         defaultValue: 60,
    //         description: 'Number of occurrences allowed over duration.',
    //       },
    //       duration: {
    //         type: GraphQLNonNull(GraphQLInt),
    //         defaultValue: 60,
    //         description: 'Number of seconds before limit is reset.',
    //       },
    //     },
    //   });
    // }

    visitObject(object: GraphQLObjectType) {
      // Wrap fields for limiting that don't have their own @rateLimit
      const fields = object.getFields();
      Object.values(fields).forEach((field) => {
        if (!field.astNode) return;
        const directives = field.astNode.directives;
        if (
          !directives ||
          !directives.some((directive) => directive.name.value === this.name)
        ) {
          this.rateLimit(field);
        }
      });
    }

    visitFieldDefinition(field: GraphQLField<unknown, TContext>) {
      this.rateLimit(field);
    }

    private getLimiter(): RateLimiterAbstract {
      const limiterKey = limiterKeyGenerator(this.args);
      let limiter = limiters.get(limiterKey);
      if (limiter === undefined) {
        limiter = new limiterClass({
          ...limiterOptions,
          keyPrefix:
            limiterOptions.keyPrefix === undefined
              ? this.name // change the default behaviour which is to use 'rlflx'
              : limiterOptions.keyPrefix,
          points: this.args.limit,
          duration: this.args.duration,
        });
        limiters.set(limiterKey, limiter);
      }
      return limiter;
    }

    private rateLimit(field: GraphQLField<unknown, TContext>) {
      const { resolve = defaultFieldResolver } = field;
      const limiter = this.getLimiter();
      field.resolve = async (obj, args, context, info) => {
        const pointsToConsume = await pointsCalculator(
          this.args,
          obj,
          args,
          context,
          info,
        );
        if (pointsToConsume !== 0) {
          const key = await keyGenerator(this.args, obj, args, context, info);
          try {
            await limiter.consume(key, pointsToConsume);
          } catch (e) {
            if (e instanceof Error) {
              throw e;
            }

            const resource = e as RateLimiterRes;
            return onLimit(resource, this.args, obj, args, context, info);
          }
        }
        return resolve.apply(this, [obj, args, context, info]);
      };
    }
  };
}
