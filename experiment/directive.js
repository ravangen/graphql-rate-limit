const { ApolloServer, gql } = require('apollo-server');
const { defaultFieldResolver } = require('graphql');
const { makeExecutableSchema, SchemaDirectiveVisitor } = require('graphql-tools');

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
    max: Int = 60,
    period: RateLimitPeriod = MINUTE,
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

function createRateLimitDirective(keyGenerator, errorMessage) {
  class RateLimitDirective extends SchemaDirectiveVisitor {
    visitObject(object) {
      // Wrap fields for limiting that don't have their own @rateLimit
      const fields = object.getFields();
      Object.values(fields).forEach(field => {
        const directives = field.astNode.directives;
        if (!directives || !directives.some(directive => directive.name.value === 'rateLimit')) {
          this.limit(field);
        }
      });
    }
    visitFieldDefinition(field) {
      this.limit(field);
    }
    limit(field) {
      // Rate limit this field
      const { resolve = defaultFieldResolver } = field;
      field.resolve = async (...args) => {
        console.log(`${keyGenerator(...args)}: ${this.args.max}/${this.args.period}`);
        return resolve.apply(this, args);
      };
    }
  }
  return RateLimitDirective;
}

const keyGenerator = (parent, args, context, info) => {
  return info.fieldName;
};

const schema = makeExecutableSchema({
  typeDefs,
  resolvers,
  schemaDirectives: {
    rateLimit: createRateLimitDirective(keyGenerator, 'Too many requests.'),
  }
});

const server = new ApolloServer({ schema });
server.listen().then(({ url }) => {
  console.log(`🚀  Server ready at ${url}`);
});
