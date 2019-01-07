import {
  defaultFieldResolver,
  GraphQLField,
  GraphQLObjectType,
  GraphQLResolveInfo,
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
  source: any,
  args: { [key: string]: any },
  context: TContext,
  info: GraphQLResolveInfo,
  directiveArgs: RateLimitArgs,
) => string;

export interface IOptions<TContext> {
  directiveName?: string;
  keyGenerator?: RateLimitKeyGenerator<TContext>;
  onLimitReached?: Function;
  limiterClass?: typeof RateLimiterAbstract;
  limiterOptions?: Exclude<
    IRateLimiterOptions,
    { points?: number; duration?: number }
  >;
}

export function createRateLimitDirective<TContext>({
  directiveName = 'rateLimit',
  keyGenerator = (
    source: any,
    args: { [key: string]: any },
    context: TContext,
    info: GraphQLResolveInfo,
    directiveArgs: RateLimitArgs,
  ) => `${info.parentType}.${info.fieldName}`,
  limiterClass = RateLimiterMemory,
}: IOptions<TContext> = {}): typeof SchemaDirectiveVisitor {
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

    rateLimit(field: GraphQLField<any, TContext>) {
      const { resolve = defaultFieldResolver } = field;
      field.resolve = async (source, args, context, info) => {
        const key = keyGenerator(source, args, context, info, this.args);
        return resolve.apply(this, [source, args, context, info]);
      };
    }
  };
}
