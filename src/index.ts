import { gql } from 'apollo-server';
import {
  defaultFieldResolver,
  GraphQLField,
  GraphQLObjectType,
  GraphQLResolveInfo,
} from 'graphql';
import { SchemaDirectiveVisitor } from 'graphql-tools';

export const RateLimitTypeDefs = gql`
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

// export const RateLimitPeriodType = new GraphQLEnumType({
//   name: 'RateLimitPeriod',
//   description: 'Unit of time to measure usage over',
//   values: {
//     // Name of the enum value will be used as its internal value.
//     SECOND: {},
//     MINUTE: {},
//     HOUR: {},
//     DAY: {},
//   },
// });
//
// export const RateLimitDirective = new GraphQLDirective({
//   name: 'rateLimit',
//   locations: [
//     DirectiveLocation.OBJECT,
//     DirectiveLocation.FIELD_DEFINITION,
//   ],
//   args: {
//     max: {
//       type: GraphQLInt,
//       defaultValue: 60,
//     },
//     period: {
//       type: RateLimitPeriodType,
//       defaultValue: 'MINUTE',
//     },
//   },
// });

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

export interface IOptions<TContext> {
  directiveName?: string;
  keyGenerator?: RateLimitKeyGenerator<TContext>;
  onLimitReached?: Function;
  store?: Store;
}

export function createRateLimitDirective<TContext>(
  options: IOptions<TContext> = {},
): typeof SchemaDirectiveVisitor {
  const keyGenerator = options.keyGenerator
    ? options.keyGenerator
    : (source: any, args: any, context: TContext, info: GraphQLResolveInfo) =>
        info.fieldName;

  class RateLimitDirective extends SchemaDirectiveVisitor {
    // static getDirectiveDeclaration(
    //   directiveName: string = options.directiveName,
    //   schema: GraphQLSchema,
    // ) {
    //   return new GraphQLDirective({
    //     name: directiveName,
    //     locations: [
    //       DirectiveLocation.OBJECT,
    //       DirectiveLocation.FIELD_DEFINITION,
    //     ],
    //     args: {
    //       max: {
    //         type: GraphQLInt,
    //         defaultValue: 60,
    //       },
    //       period: {
    //         type: schema.getType('RateLimitPeriod') as GraphQLEnumType,
    //         defaultValue: 'MINUTE',
    //       },
    //     },
    //   });
    // }
    visitObject(object: GraphQLObjectType) {
      // Wrap fields for limiting that don't have their own @rateLimit
      const fields = object.getFields();
      Object.values(fields).forEach(field => {
        if (!field.astNode) return;
        const directives = field.astNode.directives;
        if (
          !directives ||
          !directives.some(
            directive => directive.name.value === options.directiveName,
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
        const key = keyGenerator(...args);
        console.log(`${key}: ${this.args.max}/${this.args.period}`);
        return resolve.apply(this, args);
      };
    }
  }
  return RateLimitDirective;
}
