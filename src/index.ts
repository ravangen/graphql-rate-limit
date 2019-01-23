import {
  defaultFieldResolver,
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

export const rateLimitTypeDefs = gql`
  """
  Controls the rate of traffic.
  """
  directive @rateLimit(
    """
    Quantity that is allowed per period.
    """
    limit: Int = 60

    """
    Number of seconds before limit is reset.
    """
    duration: Int = 60
  ) on OBJECT | FIELD_DEFINITION
`;

export interface RateLimitArgs {
  limit: number;
  duration: number;
}

export type RateLimitKeyGenerator<TContext> = (
  directiveArgs: RateLimitArgs,
  source: any,
  args: { [key: string]: any },
  context: TContext,
  info: GraphQLResolveInfo,
) => string;

export type RateLimitThrottle<TContext> = (
  resource: RateLimiterRes,
  source: any,
  args: { [key: string]: any },
  context: TContext,
  info: GraphQLResolveInfo,
) => any;

export interface IOptions<TContext> {
  directiveName?: string;
  keyGenerator?: RateLimitKeyGenerator<TContext>;
  throttle?: RateLimitThrottle<TContext>;
  limiterClass?: typeof RateLimiterAbstract;
  limiterOptions?: Pick<
    IRateLimiterOptions,
    Exclude<
      keyof IRateLimiterOptions,
      keyof { points?: number; duration?: number }
    >
  >;
}

export function createRateLimitDirective<TContext>({
  // TODO: may be enough to use this.name on SchemaDirectiveVisitor
  directiveName = 'rateLimit',
  keyGenerator = (
    directiveArgs: RateLimitArgs,
    source: any,
    args: { [key: string]: any },
    context: TContext,
    info: GraphQLResolveInfo,
  ) => `${info.parentType}.${info.fieldName}`,
  throttle = (
    resource: RateLimiterRes,
    source: any,
    args: { [key: string]: any },
    context: TContext,
    info: GraphQLResolveInfo,
  ): any => {
    throw new GraphQLError(
      `Too many requests, please try again in ${Math.ceil(
        resource.msBeforeNext / 1000,
      )} seconds.`,
    );
  },
  limiterClass = RateLimiterMemory,
  limiterOptions = {},
}: IOptions<TContext> = {}): typeof SchemaDirectiveVisitor {
  const limiters = new Map<string, RateLimiterAbstract>();
  const limiterKeyGenerator = ({ limit, duration }: RateLimitArgs): string =>
    `${limit}/${duration}s`;

  return class extends SchemaDirectiveVisitor {
    args: RateLimitArgs;

    visitObject(object: GraphQLObjectType) {
      // Wrap fields for limiting that don't have their own @rateLimit
      const fields = object.getFields();
      Object.values(fields).forEach(field => {
        if (!field.astNode) return;
        const directives = field.astNode.directives;
        if (
          !directives ||
          !directives.some(directive => directive.name.value === directiveName)
        ) {
          this.rateLimit(field);
        }
      });
    }

    visitFieldDefinition(field: GraphQLField<any, TContext>) {
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
              ? directiveName // change default behaviour which is to use 'rlflx'
              : limiterOptions.keyPrefix,
          points: this.args.limit,
          duration: this.args.duration,
        });
        limiters.set(limiterKey, limiter);
      }
      return limiter;
    }

    private rateLimit(field: GraphQLField<any, TContext>) {
      const { resolve = defaultFieldResolver } = field;
      const limiter = this.getLimiter();
      field.resolve = async (source, args, context, info) => {
        const key = keyGenerator(this.args, source, args, context, info);
        try {
          await limiter.consume(key);
        } catch (e) {
          if (e instanceof Error) {
            throw e;
          }

          const resource = e as RateLimiterRes;
          return throttle(resource, source, args, context, info);
        }
        return resolve.apply(this, [source, args, context, info]);
      };
    }
  };
}
