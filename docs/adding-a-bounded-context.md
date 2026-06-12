# Adding a new Bounded Context

This walkthrough shows how to add a `Product` bounded context end-to-end. Use the
existing [`src/modules/user/`](../src/modules/user/) module as the canonical reference —
this guide tells you the **order of operations** so you don't get stuck.

By the end you'll have:

- `Product` aggregate with a domain event
- A use case behind a primary port
- An in-memory repository (for unit tests)
- A MikroORM repository + persister (for production)
- A migration
- REST endpoints wired into `main.ts`

Total time on a quiet afternoon: ~30 min.

---

## 0. Conventions you'll follow

Before starting, internalize these (every module follows them):

- **Identifiers** are subclasses of `Identifier` — never raw strings in domain code.
- **Value objects** are immutable (`Object.defineProperty`), props are `protected`, getters are public.
- **Aggregates** emit events through `addDomainEvent()`. Persistence is automatic via the tracker — **don't call `repository.save()` from use cases**.
- **Commands** have a private constructor + static `of(...primitives)` factory.
- **MikroORM ORM entities MUST `extends PlainObject`** (including child entities). Without it, hydration breaks silently.
- **Use cases return `Promise<T>` directly** — no wrapper types.

---

## 1. Domain layer

```
src/modules/product/domain/
├── aggregates/Product.ts
├── identifiers/ProductId.ts
├── valueObjects/
│   ├── ProductName.ts
│   └── ProductPrice.ts
└── events/ProductCreatedEvent.ts
```

### `ProductId`

```ts
import { Identifier } from "../../../../shared/domain/identifiers/Identifier.ts";

export class ProductId extends Identifier {}
```

### Value object example

```ts
import { ValueObject } from "../../../../shared/domain/valueObjects/ValueObject.ts";

interface Props {
  readonly value: string;
}

export class ProductName extends ValueObject<Props> {
  public get value(): string {
    return this.props.value;
  }

  constructor(value: string) {
    if (value.trim().length === 0) {
      throw new Error("ProductName cannot be empty");
    }
    super({ value });
  }
}
```

### Aggregate

```ts
import { AggregateRoot } from "../../../../shared/domain/aggregates/AggregateRoot.ts";
import { ProductId } from "../identifiers/ProductId.ts";
import { ProductName } from "../valueObjects/ProductName.ts";
import { ProductPrice } from "../valueObjects/ProductPrice.ts";
import { ProductCreatedEvent } from "../events/ProductCreatedEvent.ts";

interface Props {
  readonly name: ProductName;
  readonly price: ProductPrice;
}

export class Product extends AggregateRoot<ProductId, Props> {
  public get name(): ProductName {
    return this.props.name;
  }
  public get price(): ProductPrice {
    return this.props.price;
  }

  public static create(id: ProductId, name: ProductName, price: ProductPrice): Product {
    const product = new Product(id, { name, price });
    product.addDomainEvent(new ProductCreatedEvent(id.value, name.value, price.value));
    return product;
  }

  /** Hydration from persistence — does NOT emit events. */
  public static reconstitute(id: ProductId, name: ProductName, price: ProductPrice): Product {
    return new Product(id, { name, price });
  }
}
```

### Domain event

```ts
import { randomUUID } from "node:crypto";
import type { DomainEvent } from "../../../../shared/domain/events/DomainEvent.ts";

export class ProductCreatedEvent implements DomainEvent {
  public readonly eventId: string;
  public readonly eventName = "ProductCreated";
  public readonly occurredAt: Date;
  public readonly aggregateId: string;
  public readonly causationId: string | null;

  constructor(
    aggregateId: string,
    public readonly name: string,
    public readonly price: number,
  ) {
    this.eventId = randomUUID();
    this.occurredAt = new Date();
    this.aggregateId = aggregateId;
    this.causationId = null;
  }
}
```

---

## 2. Application layer

```
src/modules/product/application/
├── command/CreateProductCommand.ts
├── port/
│   ├── primary/CreateProductPort.ts
│   └── secondary/ProductRepositoryPort.ts
└── usecase/CreateProductUseCase.ts
```

### Command

```ts
import { randomUUID } from "node:crypto";
import { ProductId } from "../../domain/identifiers/ProductId.ts";
import { ProductName } from "../../domain/valueObjects/ProductName.ts";
import { ProductPrice } from "../../domain/valueObjects/ProductPrice.ts";

export class CreateProductCommand {
  public readonly productId: ProductId;
  public readonly name: ProductName;
  public readonly price: ProductPrice;

  private constructor(productId: ProductId, name: ProductName, price: ProductPrice) {
    this.productId = productId;
    this.name = name;
    this.price = price;
  }

  public static of(name: string, price: number): CreateProductCommand {
    return new CreateProductCommand(
      new ProductId(randomUUID()),
      new ProductName(name),
      new ProductPrice(price),
    );
  }
}
```

### Repository port (secondary)

```ts
import type { Product } from "../../../domain/aggregates/Product.ts";
import type { ProductId } from "../../../domain/identifiers/ProductId.ts";
import type { RepositoryPort } from "../../../../../shared/ports/RepositoryPort.ts";

export interface ProductRepositoryPort extends RepositoryPort<ProductId, Product> {}
```

### Use case

```ts
import type { UseCase } from "../../../../shared/application/UseCase.ts";
import type { ProductRepositoryPort } from "../port/secondary/ProductRepositoryPort.ts";
import type { CreateProductCommand } from "../command/CreateProductCommand.ts";
import { Product } from "../../domain/aggregates/Product.ts";

export class CreateProductUseCase implements UseCase<CreateProductCommand, Product> {
  constructor(private readonly repository: ProductRepositoryPort) {}

  public async execute(command: CreateProductCommand): Promise<Product> {
    return Product.create(command.productId, command.name, command.price);
    // Note: NO repository.save() — the AggregateTracker handles it on commit.
  }
}
```

---

## 3. Infrastructure — in-memory (for tests)

```ts
// src/modules/product/infrastructure/persistence/in-memory/InMemoryProductRepository.ts
import type { ProductId } from "../../../domain/identifiers/ProductId.ts";
import type { Product } from "../../../domain/aggregates/Product.ts";
import type { ProductRepositoryPort } from "../../../application/port/secondary/ProductRepositoryPort.ts";

export class InMemoryProductRepository implements ProductRepositoryPort {
  private readonly store = new Map<string, Product>();

  public async save(product: Product): Promise<void> {
    this.store.set(product.id.value, product);
  }

  public async findById(id: ProductId): Promise<Product | null> {
    return this.store.get(id.value) ?? null;
  }

  public async delete(id: ProductId): Promise<void> {
    this.store.delete(id.value);
  }
}
```

---

## 4. Infrastructure — MikroORM

```
src/modules/product/infrastructure/persistence/mikro-orm/
├── entities/ProductEntity.ts
├── schemas/ProductEntitySchema.ts
├── mappers/ProductMapper.ts
└── repositories/MikroOrmProductRepository.ts
```

### ORM entity (MUST extend PlainObject)

```ts
// entities/ProductEntity.ts
import { PlainObject } from "@mikro-orm/core";

export class ProductEntity extends PlainObject {
  public id!: string;
  public name!: string;
  public price!: number;
}
```

### EntitySchema

```ts
// schemas/ProductEntitySchema.ts
import { EntitySchema } from "@mikro-orm/core";
import { ProductEntity } from "../entities/ProductEntity.ts";

export const ProductEntitySchema = new EntitySchema({
  class: ProductEntity,
  tableName: "products",
  properties: {
    id: { type: "uuid", primary: true },
    name: { type: "string" },
    price: { type: "decimal" },
  },
});
```

### Mapper

```ts
// mappers/ProductMapper.ts
import { Product } from "../../../domain/aggregates/Product.ts";
import { ProductId } from "../../../domain/identifiers/ProductId.ts";
import { ProductName } from "../../../domain/valueObjects/ProductName.ts";
import { ProductPrice } from "../../../domain/valueObjects/ProductPrice.ts";
import { ProductEntity } from "../entities/ProductEntity.ts";

export class ProductMapper {
  public static toOrmEntity(product: Product): ProductEntity {
    const entity = new ProductEntity();
    entity.id = product.id.value;
    entity.name = product.name.value;
    entity.price = product.price.value;
    return entity;
  }

  public static toDomain(entity: ProductEntity): Product {
    return Product.reconstitute(
      new ProductId(entity.id),
      new ProductName(entity.name),
      new ProductPrice(entity.price),
    );
  }
}
```

### Repository

```ts
// repositories/MikroOrmProductRepository.ts
import type { EntityManagerProvider } from "../../../../../shared/infrastructure/persistence/adapters/EntityManagerProvider.ts";
import type { ProductRepositoryPort } from "../../../application/port/secondary/ProductRepositoryPort.ts";
import type { ProductId } from "../../../domain/identifiers/ProductId.ts";
import { Product } from "../../../domain/aggregates/Product.ts";
import { ProductEntity } from "../entities/ProductEntity.ts";
import { ProductMapper } from "../mappers/ProductMapper.ts";

export class MikroOrmProductRepository implements ProductRepositoryPort {
  constructor(private readonly emProvider: EntityManagerProvider) {}

  public async save(_product: Product): Promise<void> {
    // No-op: the AggregatePersister persists on commit.
  }

  public async findById(id: ProductId): Promise<Product | null> {
    const em = this.emProvider.getEntityManager();
    const entity = await em.findOne(ProductEntity, { id: id.value });
    return entity === null ? null : ProductMapper.toDomain(entity);
  }

  public async delete(_id: ProductId): Promise<void> {
    // No-op: aggregate.markForDeletion() routes through the persister.
  }
}
```

---

## 5. Module bootstrap & factory

```ts
// src/modules/product/bootstrap/ProductModule.ts
import type { ApplicationService } from "../../../shared/application/ApplicationService.ts";
import type { HttpServer } from "../../../shared/infrastructure/http/HttpServer.ts";
import type { ProductRepositoryPort } from "../application/port/secondary/ProductRepositoryPort.ts";
import { CreateProductUseCase } from "../application/usecase/CreateProductUseCase.ts";
import { CreateProductCommand } from "../application/command/CreateProductCommand.ts";

export class ProductModule {
  private readonly createProductUseCase: CreateProductUseCase;

  constructor(
    private readonly appService: ApplicationService,
    repository: ProductRepositoryPort,
  ) {
    this.createProductUseCase = new CreateProductUseCase(repository);
  }

  public registerRoutes(http: HttpServer): void {
    http.post("/products", async (body) => {
      const command = CreateProductCommand.of(body.name as string, body.price as number);
      const product = await this.appService.execute(this.createProductUseCase, command);
      return {
        statusCode: 201,
        body: { id: product.id.value, name: product.name.value, price: product.price.value },
      };
    });
  }
}
```

```ts
// src/modules/product/factories/index.ts
import type { EntityManagerProvider } from "../../../shared/infrastructure/persistence/adapters/EntityManagerProvider.ts";
import type { AggregatePersister } from "../../../shared/infrastructure/persistence/AggregatePersister.ts";
import type { InfrastructureResult } from "../../../shared/factories/index.ts";
import { MikroOrmAggregatePersister } from "../../../shared/infrastructure/persistence/adapters/MikroOrmAggregatePersister.ts";
import { Product } from "../domain/aggregates/Product.ts";
import { ProductEntity } from "../infrastructure/persistence/mikro-orm/entities/ProductEntity.ts";
import { ProductMapper } from "../infrastructure/persistence/mikro-orm/mappers/ProductMapper.ts";
import { MikroOrmProductRepository } from "../infrastructure/persistence/mikro-orm/repositories/MikroOrmProductRepository.ts";
import { ProductModule } from "../bootstrap/ProductModule.ts";

export interface ProductModuleSetup {
  readonly persisters: ReadonlyArray<AggregatePersister>;
  register(infrastructure: InfrastructureResult): void;
}

export class ProductModuleFactory {
  public static create(emProvider: EntityManagerProvider): ProductModuleSetup {
    const persister = new MikroOrmAggregatePersister({
      aggregateClass: Product,
      ormEntityClass: ProductEntity,
      toOrmEntity: (p) => ProductMapper.toOrmEntity(p),
    });

    const repository = new MikroOrmProductRepository(emProvider);

    return {
      persisters: [persister],
      register(infrastructure) {
        const module = new ProductModule(infrastructure.applicationService, repository);
        module.registerRoutes(infrastructure.httpServer);
      },
    };
  }
}
```

---

## 6. Wire it in `main.ts`

```ts
import { ProductModuleFactory } from "./modules/product/factories/index.ts";

// ...
const productModule = ProductModuleFactory.create(entityManagerProvider);

const infrastructure = InfrastructureFactory.create(entityManagerProvider, [
  ...userModule.persisters,
  ...productModule.persisters, // ← add here
]);

userModule.register(infrastructure, logger);
productModule.register(infrastructure); // ← add here
```

---

## 7. Register the schema and create the migration

```ts
// src/mikro-orm.config.ts
import { ProductEntitySchema } from "./modules/product/infrastructure/persistence/mikro-orm/schemas/ProductEntitySchema.ts";

export default defineConfig({
  // ...
  entities: [UserEntitySchema, AddressEntitySchema, SystemEventEntitySchema, ProductEntitySchema],
  // ...
});
```

```bash
npm run migration:create -- --name=AddProducts
# edit the generated file under src/migrations/ if needed
npm start  # migrations run automatically on boot
```

---

## 8. Smoke test

```bash
npm test                    # all 402+ tests still pass
npm start                   # boots REST + GraphQL
curl -X POST http://localhost:3000/products \
  -H "Content-Type: application/json" \
  -d '{"name":"Coffee","price":12.50}'
# → {"id":"...","name":"Coffee","price":12.5}
```

---

## Common pitfalls

| Symptom                                         | Cause                                                                                    |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Aggregate created but not persisted             | Forgot to add the persister to `InfrastructureFactory.create([...])`                     |
| Mapper returns `undefined` for fields           | ORM entity doesn't `extends PlainObject`                                                 |
| Use case throws "EntityManager not initialized" | Adapter created outside the request scope, called before `applicationService.execute()`  |
| Filter not applied                              | Filter not added to `EntitySchema.filters`                                               |
| `findById` works but writes never appear        | Called `repository.save()` from use case (no-op by design — emit a domain event instead) |
| Tests fail with "tracked is true" between cases | Forgot `AggregateRoot.setOnTrack(null)` in `afterEach`                                   |
