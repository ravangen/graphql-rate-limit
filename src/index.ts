import { ApolloServer, gql } from 'apollo-server';
import {
  defaultFieldResolver,
  GraphQLField,
  GraphQLObjectType,
  GraphQLResolveInfo,
} from 'graphql';
import { makeExecutableSchema, SchemaDirectiveVisitor } from 'graphql-tools';

const books = [
  {
    title: 'Harry Potter and the Chamber of Secrets',
    author: 'J.K. Rowling',
  },
  {
    title: 'Jurassic Park',
    author: 'Michael Crichton',
  },
];

const typeDefs = gql`
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

  type Book {
    title: String @rateLimit(period: DAY)
    author: String
  }

  type Query @rateLimit {
    books: [Book]
    greeting: String @rateLimit(max: 15)
  }
`;

const resolvers = {
  Query: {
    books: () => books,
    greeting: () => 'Hello!',
  },
};

export type RateLimitKeyGenerator<TContext> = (
  source: any,
  args: any,
  context: TContext,
  info: GraphQLResolveInfo,
) => string;

function createRateLimitDirective(
  keyGenerator: RateLimitKeyGenerator<any>,
  errorMessage,
) {
  class RateLimitDirective extends SchemaDirectiveVisitor {
    visitObject(object: GraphQLObjectType) {
      // Wrap fields for limiting that don't have their own @rateLimit
      const fields = object.getFields();
      Object.values(fields).forEach(field => {
        const directives = field.astNode.directives;
        if (
          !directives ||
          !directives.some(directive => directive.name.value === 'rateLimit')
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
          `${keyGenerator(...args)}: ${this.args.max}/${this.args.period}`,
        );
        return resolve.apply(this, args);
      };
    }
  }
  return RateLimitDirective;
}

const keyGenerator = (
  source: any,
  args: any,
  context: any,
  info: GraphQLResolveInfo,
) => {
  return info.fieldName;
};

const schema = makeExecutableSchema({
  typeDefs,
  resolvers,
  schemaDirectives: {
    rateLimit: createRateLimitDirective(keyGenerator, 'Too many requests.'),
  },
});

const server = new ApolloServer({ schema });
server.listen().then(({ url }) => {
  console.log(`🚀  Server ready at ${url}`);
});
