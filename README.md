# GraphQL Rate Limit

[![CircleCI](https://circleci.com/gh/ravangen/graphql-rate-limit.svg?style=shield&circle-token=5115eed32e1e82d43eb00140580186fb8e1563f6)](https://circleci.com/gh/ravangen/graphql-rate-limit) [![Renovate enabled](https://img.shields.io/badge/renovate-enabled-brightgreen.svg)](https://renovateapp.com/)

Basic rate-limiting directive for GraphQL. Use to limit repeated requests to queries and/or mutations.

## Features

- 📦 **Storage**: Supports multiple data store choices

### Data Storage

Supports [_Redis_](https://github.com/animir/node-rate-limiter-flexible/wiki/Redis), process [_Memory_](https://github.com/animir/node-rate-limiter-flexible/wiki/Memory), [_Cluster_](https://github.com/animir/node-rate-limiter-flexible/wiki/Cluster) or [_PM2_](https://github.com/animir/node-rate-limiter-flexible/wiki/PM2-cluster), [_Memcached_](https://github.com/animir/node-rate-limiter-flexible/wiki/Memcache), [_MongoDB_](https://github.com/animir/node-rate-limiter-flexible/wiki/Mongo), [_MySQL_](https://github.com/animir/node-rate-limiter-flexible/wiki/MySQL), [_PostgreSQL_](https://github.com/animir/node-rate-limiter-flexible/wiki/PostgreSQL) to control requests rate in single process or distributed environment. Storage options are provided by [`node-rate-limiter-flexible`](https://github.com/animir/node-rate-limiter-flexible).

Memory store is the default but _not_ recommended for production as it does not share state with other servers or processes.

## Contributions

Contributions, issues and feature requests are very welcome. If you are using this package and fixed a bug for yourself, please consider submitting a PR!

## License

MIT © [Robert Van Gennip](https://github.com/ravangen/)
