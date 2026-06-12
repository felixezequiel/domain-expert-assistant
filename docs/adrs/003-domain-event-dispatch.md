# ADR-003: Domain Event Dispatch

## Status

Aceita

## Contexto

Domain Events precisam ser processados apos uma operacao de dominio. Existem diferentes
estrategias de dispatch:

1. **Sincrono imediato** - handler roda inline, dentro da mesma transacao
2. **Assincrono via fila** - eventos publicados em broker externo (Kafka, RabbitMQ)
3. **Hibrido** - dispatch in-process + publicacao externa

## Decisao

Adotar o modelo **hibrido** com `DomainEventManager` para dispatch in-process.

**Fluxo:**

1. UseCase executa e retorna agregados modificados
2. ApplicationService drena eventos dos agregados
3. `DomainEventManager.dispatchAll(events)` executa handlers in-process (dentro da transacao)
4. `EventPublisherPort.publishAll(events)` publica externamente
5. UnitOfWork faz commit

**Caracteristicas do DomainEventManager:**

- Dispatch **sequencial** (preserva ordem, erro interrompe cadeia)
- Handlers sao `async` (`Promise<void>`)
- Indexado por `eventName` (string), nao por classe/tipo
- Metodo `clear()` para isolamento em testes
- Erro em handler causa rollback da transacao inteira

## Consequencias

**Positivas:**

- Handlers in-process participam da mesma transacao
- Ordem de processamento garantida
- Erro em qualquer handler causa rollback (consistencia)
- Facil de testar (sem infraestrutura externa)

**Negativas:**

- Handlers in-process adicionam latencia a operacao principal
- Eventos externos so sao publicados apos handlers in-process
- Se a publicacao externa falhar, a transacao ja comitou
