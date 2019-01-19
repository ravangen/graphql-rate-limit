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

export interface IOptions<TContext> {
  directiveName?: string;
  keyGenerator?: RateLimitKeyGenerator<TContext>;
  onLimitReached?: Function;
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
  directiveName = 'rateLimit',
  keyGenerator = (
    directiveArgs: RateLimitArgs,
    source: any,
    args: { [key: string]: any },
    context: TContext,
    info: GraphQLResolveInfo,
  ) => `${info.parentType}.${info.fieldName}`,
  onLimitReached = () => {
    throw new GraphQLError('RATE LIMITED');
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
          return onLimitReached();
        }
        return resolve.apply(this, [source, args, context, info]);
      };
    }
  };
}
