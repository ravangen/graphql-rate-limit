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

export interface RateLimitConfig {
  directiveName?: string;
  keyGenerator?: RateLimitKeyGenerator<any>;
  onLimitReached?: Function;
}

export const createRateLimitDirective = (config: RateLimitConfig = {
  directiveName: 'rateLimit',
  keyGenerator: (source: any, args: any, context: any, info: GraphQLResolveInfo) => info.fieldName,
  onLimitReached: () => {},
}): typeof SchemaDirectiveVisitor => {
  class RateLimitDirective extends SchemaDirectiveVisitor {
    visitObject(object: GraphQLObjectType) {
      // Wrap fields for limiting that don't have their own @rateLimit
      const fields = object.getFields();
      Object.values(fields).forEach(field => {
        const directives = field.astNode.directives;
        if (
          !directives ||
          !directives.some(directive => directive.name.value === config.directiveName)
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
        console.log(
          `${config.keyGenerator(...args)}: ${this.args.max}/${this.args.period}`,
        );
        return resolve.apply(this, args);
      };
    }
  }
  return RateLimitDirective;
}
