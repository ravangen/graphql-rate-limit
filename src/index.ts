import { gql } from 'apollo-server';
import {
  defaultFieldResolver,
  GraphQLField,
  GraphQLObjectType,
  GraphQLResolveInfo,
} from 'graphql';
import { SchemaDirectiveVisitor } from 'graphql-tools';

export const rateLimitTypeDefs = gql`
  directive @rateLimit(
    max: Int = 60
    period: RateLimitPeriod = MINUTE
  ) on OBJECT | FIELD_DEFINITION

  enum RateLimitPeriod {
    SECOND
    MINUTE
    HOUR
    DAY
  }
`;

export type RateLimitKeyGenerator<TContext> = (
  source: any,
  args: any,
  context: TContext,
  info: GraphQLResolveInfo,
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

export interface RateLimitConfig {
  directiveName?: string;
  keyGenerator?: RateLimitKeyGenerator<any>;
  onLimitReached?: Function;
  store?: Store;
}

export const createRateLimitDirective = (
  config: RateLimitConfig = {
    directiveName: 'rateLimit',
    keyGenerator: (
      source: any,
      args: any,
      context: any,
      info: GraphQLResolveInfo,
    ) => info.fieldName,
    onLimitReached: () => {
      /* no-op */
    },
  },
): typeof SchemaDirectiveVisitor => {
  class RateLimitDirective extends SchemaDirectiveVisitor {
    visitObject(object: GraphQLObjectType) {
      // Wrap fields for limiting that don't have their own @rateLimit
      const fields = object.getFields();
      Object.values(fields).forEach(field => {
        const directives = field.astNode.directives;
        if (
          !directives ||
          !directives.some(
            directive => directive.name.value === config.directiveName,
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
      field.resolve = async (...args) => {
        const key = config.keyGenerator(...args);
        console.log(`${key}: ${this.args.max}/${this.args.period}`);
        return resolve.apply(this, args);
      };
    }
  }
  return RateLimitDirective;
};
