import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { GraphqlServer } from "./GraphqlServer.ts";

const TEST_PORT = 0;

async function postGraphql(
  port: number,
  query: string,
  variables?: Record<string, unknown>,
): Promise<{ status: number; body: unknown }> {
  const response = await fetch("http://localhost:" + port + "/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const body = await response.json();
  return { status: response.status, body };
}

describe("GraphqlServer", () => {
  let server: GraphqlServer;

  afterEach(async () => {
    if (server !== undefined) {
      await server.stop();
    }
  });

  it("should execute a simple query", async () => {
    const schema = `
      type Query {
        hello: String
      }
    `;

    const resolvers = {
      Query: {
        hello: async () => "world",
      },
    };

    server = new GraphqlServer(schema, resolvers);
    const port = await server.start(TEST_PORT);

    const result = await postGraphql(port, "{ hello }");

    assert.equal(result.status, 200);
    const body = result.body as { data: { hello: string } };
    assert.equal(body.data.hello, "world");
  });

  it("should execute a mutation with variables", async () => {
    const schema = `
      type Mutation {
        createItem(name: String!): Item!
      }

      type Item {
        name: String!
      }

      type Query {
        _empty: String
      }
    `;

    const resolvers = {
      Mutation: {
        createItem: async (_parent: unknown, args: { name: string }) => {
          return { name: args.name };
        },
      },
    };

    server = new GraphqlServer(schema, resolvers);
    const port = await server.start(TEST_PORT);

    const mutation = `mutation CreateItem($name: String!) { createItem(name: $name) { name } }`;
    const result = await postGraphql(port, mutation, { name: "Test Item" });

    assert.equal(result.status, 200);
    const body = result.body as { data: { createItem: { name: string } } };
    assert.equal(body.data.createItem.name, "Test Item");
  });

  it("should return errors for invalid queries", async () => {
    const schema = `
      type Query {
        hello: String
      }
    `;

    server = new GraphqlServer(schema, {});
    const port = await server.start(TEST_PORT);

    const result = await postGraphql(port, "{ nonExistent }");

    assert.equal(result.status, 200);
    const body = result.body as { errors: Array<{ message: string }> };
    assert.ok(body.errors.length > 0);
  });

  it("should return errors when resolver throws", async () => {
    const schema = `
      type Query {
        fail: String
      }
    `;

    const resolvers = {
      Query: {
        fail: async () => {
          throw new Error("Something broke");
        },
      },
    };

    server = new GraphqlServer(schema, resolvers);
    const port = await server.start(TEST_PORT);

    const result = await postGraphql(port, "{ fail }");

    assert.equal(result.status, 200);
    const body = result.body as { errors: Array<{ message: string }> };
    assert.ok(body.errors.length > 0);
    assert.equal(body.errors[0]!.message, "Something broke");
  });

  it("should merge schemas from multiple calls to addSchema", async () => {
    server = new GraphqlServer();

    server.addSchema(`extend type Mutation { greet(name: String!): String! }`, {
      Mutation: { greet: async (_parent: unknown, args: { name: string }) => "Hello " + args.name },
    });

    server.addSchema(`extend type Mutation { farewell(name: String!): String! }`, {
      Mutation: {
        farewell: async (_parent: unknown, args: { name: string }) => "Bye " + args.name,
      },
    });

    const port = await server.start(TEST_PORT);

    const greetResult = await postGraphql(port, `mutation { greet(name: "John") }`);
    const greetBody = greetResult.body as { data: { greet: string } };
    assert.equal(greetBody.data.greet, "Hello John");

    const farewellResult = await postGraphql(port, `mutation { farewell(name: "John") }`);
    const farewellBody = farewellResult.body as { data: { farewell: string } };
    assert.equal(farewellBody.data.farewell, "Bye John");
  });

  it("should stop the server gracefully", async () => {
    const schema = `type Query { hello: String }`;
    server = new GraphqlServer(schema, {});
    const port = await server.start(TEST_PORT);

    await server.stop();

    await assert.rejects(() => fetch("http://localhost:" + port + "/graphql"));
  });
});
