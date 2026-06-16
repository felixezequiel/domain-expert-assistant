import { useState } from "react";
import { collectionsApi, credentialsApi } from "../../api/resources.ts";
import { SENSITIVITY_LEVELS, type ConsumerCredentialView } from "../../api/types.ts";
import { useAsync } from "../../hooks/useAsync.ts";
import { AsyncBoundary, ErrorNotice } from "../../components/AsyncBoundary.tsx";
import { SecretRevealDialog } from "../../components/SecretRevealDialog.tsx";

export function CredentialsPage(): JSX.Element {
  const credentials = useAsync(() => credentialsApi.list(), []);
  const collections = useAsync(() => collectionsApi.list(), []);

  const [name, setName] = useState("");
  const [collectionIds, setCollectionIds] = useState<ReadonlyArray<string>>([]);
  const [ceiling, setCeiling] = useState<string>("internal");
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);

  const issue = async (): Promise<void> => {
    setError(null);
    try {
      const result = await credentialsApi.issue(name, collectionIds, ceiling);
      setRevealedSecret(result.secret);
      setName("");
      setCollectionIds([]);
      credentials.reload();
    } catch (caught) {
      setError(caught);
    }
  };

  const rotate = async (id: string): Promise<void> => {
    setError(null);
    try {
      const result = await credentialsApi.rotate(id);
      setRevealedSecret(result.secret);
      credentials.reload();
    } catch (caught) {
      setError(caught);
    }
  };

  const revoke = async (id: string): Promise<void> => {
    setError(null);
    try {
      await credentialsApi.revoke(id);
      credentials.reload();
    } catch (caught) {
      setError(caught);
    }
  };

  const toggleCollection = (id: string): void => {
    if (collectionIds.includes(id)) {
      setCollectionIds(collectionIds.filter((value) => value !== id));
    } else {
      setCollectionIds([...collectionIds, id]);
    }
  };

  return (
    <section>
      <h2>Consumer credentials</h2>
      {error !== null ? <ErrorNotice error={error} /> : null}

      <div className="card">
        <h3>Issue credential</h3>
        <label htmlFor="cred-name">Name</label>
        <input id="cred-name" value={name} onChange={(event) => setName(event.target.value)} />

        <fieldset className="roles">
          <legend>Scoped collections</legend>
          {(collections.data?.collections ?? []).map((collection) => (
            <label key={collection.id} htmlFor={`cred-coll-${collection.id}`}>
              <input
                id={`cred-coll-${collection.id}`}
                type="checkbox"
                checked={collectionIds.includes(collection.id)}
                onChange={() => toggleCollection(collection.id)}
              />
              {collection.name}
            </label>
          ))}
        </fieldset>

        <label htmlFor="cred-ceiling">Sensitivity ceiling</label>
        <select id="cred-ceiling" value={ceiling} onChange={(event) => setCeiling(event.target.value)}>
          {SENSITIVITY_LEVELS.map((level) => (
            <option key={level} value={level}>
              {level}
            </option>
          ))}
        </select>

        <button type="button" onClick={() => void issue()}>
          Issue
        </button>
      </div>

      <AsyncBoundary loading={credentials.loading} error={credentials.error}>
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Prefix</th>
              <th>Scope</th>
              <th>Ceiling</th>
              <th>Status</th>
              <th>Last used</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(credentials.data?.credentials ?? []).map((credential: ConsumerCredentialView) => (
              <tr key={credential.id}>
                <td>{credential.name}</td>
                <td>
                  <code>{credential.keyPrefix}</code>
                </td>
                <td>{credential.collectionIds.length === 0 ? "all" : credential.collectionIds.join(", ")}</td>
                <td>{credential.sensitivityCeiling}</td>
                <td>{credential.status}</td>
                <td>{credential.lastUsedAt ?? "never"}</td>
                <td>
                  <button type="button" onClick={() => void rotate(credential.id)}>
                    Rotate
                  </button>
                  <button type="button" onClick={() => void revoke(credential.id)}>
                    Revoke
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </AsyncBoundary>

      {revealedSecret !== null ? (
        <SecretRevealDialog secret={revealedSecret} onClose={() => setRevealedSecret(null)} />
      ) : null}
    </section>
  );
}
