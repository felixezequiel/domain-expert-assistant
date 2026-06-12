import { createServer, type IncomingMessage, type ServerResponse, type Server } from "node:http";
import { buildSchema, graphql, type GraphQLSchema } from "graphql";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ResolverFunction = (parent: unknown, args: any) => Promise<unknown>;

interface ResolverMap {
  [typeName: string]: {
    [fieldName: string]: ResolverFunction;
  };
}

interface GraphqlRequest {
  readonly query: string;
  readonly variables?: Record<string, unknown>;
}

const BASE_SCHEMA = `
  type Query { _empty: String }
  type Mutation { _empty: String }
`;

export class GraphqlServer {
  private readonly schemaFragments: Array<string> = [];
  private readonly resolverMaps: Array<ResolverMap> = [];
  private schema: GraphQLSchema | undefined;
  private server: Server | undefined;

  public get schemaFragmentCount(): number {
    return this.schemaFragments.length;
  }

  constructor(schemaSource?: string, resolvers?: ResolverMap) {
    if (schemaSource !== undefined) {
      this.schema = buildSchema(schemaSource);
      if (resolvers !== undefined) {
        this.resolverMaps.push(resolvers);
      }
    }
  }

  public addSchema(schemaFragment: string, resolvers: ResolverMap): void {
    this.schemaFragments.push(schemaFragment);
    this.resolverMaps.push(resolvers);
  }

  public start(port: number): Promise<number> {
    if (this.schema === undefined) {
      const fullSchema = BASE_SCHEMA + "\n" + this.schemaFragments.join("\n");
      this.schema = buildSchema(fullSchema);
    }

    return new Promise((resolve) => {
      this.server = createServer((request, response) => {
        this.handleRequest(request, response);
      });

      this.server.listen(port, () => {
        const address = this.server!.address();
        const assignedPort = typeof address === "object" && address !== null ? address.port : port;
        resolve(assignedPort);
      });
    });
  }

  public stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.server === undefined) {
        resolve();
        return;
      }

      this.server.close((error) => {
        this.server = undefined;
        if (error !== undefined && error !== null) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  private handleRequest(request: IncomingMessage, response: ServerResponse): void {
    this.readBody(request)
      .then((body) => {
        const graphqlRequest = body as unknown as GraphqlRequest;
        const rootValue = this.buildRootValue();

        return graphql({
          schema: this.schema!,
          source: graphqlRequest.query,
          rootValue,
          variableValues: graphqlRequest.variables,
        });
      })
      .then((result) => {
        this.sendJson(response, 200, result);
      })
      .catch((error: Error) => {
        this.sendJson(response, 500, { errors: [{ message: error.message }] });
      });
  }

  private buildRootValue(): Record<string, (args: Record<string, unknown>) => Promise<unknown>> {
    const rootValue: Record<string, (args: Record<string, unknown>) => Promise<unknown>> = {};

    for (const resolverMap of this.resolverMaps) {
      for (const typeName of Object.keys(resolverMap)) {
        const typeResolvers = resolverMap[typeName]!;
        for (const fieldName of Object.keys(typeResolvers)) {
          const resolver = typeResolvers[fieldName]!;
          rootValue[fieldName] = (args: Record<string, unknown>) => {
            return resolver(null, args);
          };
        }
      }
    }

    return rootValue;
  }

  private readBody(request: IncomingMessage): Promise<Record<string, unknown>> {
    return new Promise((resolve) => {
      let data = "";

      request.on("data", (chunk: Buffer) => {
        data = data + chunk.toString();
      });

      request.on("end", () => {
        if (data.length === 0) {
          resolve({});
          return;
        }

        const parsed = JSON.parse(data) as Record<string, unknown>;
        resolve(parsed);
      });
    });
  }

  private sendJson(response: ServerResponse, statusCode: number, body: unknown): void {
    response.writeHead(statusCode, { "Content-Type": "application/json" });
    response.end(JSON.stringify(body));
  }
}
