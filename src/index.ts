import {
  defaultFieldResolver,
  GraphQLField,
  GraphQLObjectType,
  GraphQLResolveInfo,
} from 'graphql';
import gql from 'graphql-tag';
import { SchemaDirectiveVisitor } from 'graphql-tools';

export const rateLimitTypeDefs = gql`
  """
  Controls the rate of traffic.
  """
  directive @rateLimit(
    """
    Quantity that is allowed per period.
    """
    max: Int = 60

    """
    Unit of time being observed.
    """
    period: RateLimitPeriod = MINUTE
  ) on OBJECT | FIELD_DEFINITION

  """
  Unit of time to measure usage over.
  """
  enum RateLimitPeriod {
    """
    Smallest unit of measurement.
    """
    SECOND

    """
    60 seconds.
    """
    MINUTE

    """
    60 minutes.
    """
    HOUR

    """
    24 hours.
    """
    DAY
  }
`;

export type RateLimitKeyGenerator<TContext> = (
  source: any,
  args: any,
  context: TContext,
  info: GraphQLResolveInfo,
  directiveArgs: any,
) => string;

// Store mirrors what express-rate-limit defines: https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/express-rate-limit
export interface Store {
  /**
   * Increments the value in the underlying store for the given key.
   * @param key The key to use as the unique identifier passed down from RateLimit.
   * @param cb The callback issued when the underlying store is finished.
   */
  incr(key: string, cb: StoreIncrementCallback): void;
  /**
   * Decrements the value in the underlying store for the given key.
   * @param key The key to use as the unique identifier passed down from RateLimit.
   */
  decrement(key: string): void;
  /**
   * Resets a value with the given key.
   * @param key The key to use as the unique identifier passed down from RateLimit.
   */
  resetKey(key: string): void;
}

/**
 * @param error Error (usually null). If null, it means operation was successfully attempted.
 * @param hitCount Current number of occurrences for the given key.
 */
export type StoreIncrementCallback = (error?: {}, hitCount?: number) => void;

export interface IOptions<TContext> {
  keyGenerator?: RateLimitKeyGenerator<TContext>;
  onLimitReached?: Function;
  store?: Store;
}

export function createRateLimitDirective<TContext>(
  options: IOptions<TContext> = {},
): typeof SchemaDirectiveVisitor {
  const keyGenerator = options.keyGenerator
    ? options.keyGenerator
    : (source: any, args: any, context: TContext, info: GraphQLResolveInfo, directiveArgs: any) =>
        info.fieldName;

  return class extends SchemaDirectiveVisitor {
    visitObject(object: GraphQLObjectType) {
      // Wrap fields for limiting that don't have their own @rateLimit
      const fields = object.getFields();
      Object.values(fields).forEach(field => {
        if (!field.astNode) return;
        const directives = field.astNode.directives;
        if (
          !directives ||
          !directives.some(
            directive => directive.name.value === 'rateLimit',
          )
        ) {
          this.limit(field);
        }
      });
    }
    visitFieldDefinition(field: GraphQLField<any, any>) {
      this.limit(field);
    }
    limit(field: GraphQLField<any, any>) {
      // Rate limit this field
      const { resolve = defaultFieldResolver } = field;
      field.resolve = async (source, args, context, info) => {
        const key = keyGenerator(source, args, context, info, this.args);
        return resolve.apply(this, [source, args, context, info]);
      };
    }
  }
}
