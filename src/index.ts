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

export enum RateLimitPeriod {
  Second = 'SECOND',
  Minute = 'MINUTE',
  Hour = 'HOUR',
  Day = 'DAY',
}

export interface RateLimitArgs {
  max: number;
  period: RateLimitPeriod;
}

export type RateLimitKeyGenerator<TContext> = (
  source: any,
  args: { [key: string]: any },
  context: TContext,
  info: GraphQLResolveInfo,
  directiveArgs: RateLimitArgs,
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
  directiveName?: string;
  keyGenerator?: RateLimitKeyGenerator<TContext>;
  onLimitReached?: Function;
  store?: Store;
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
