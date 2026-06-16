import { useEffect, useRef, useState } from "react";
import { collectionsApi, ingestionApi } from "../../api/resources.ts";
import type { IngestionJobView } from "../../api/types.ts";
import { useAsync } from "../../hooks/useAsync.ts";
import { ErrorNotice } from "../../components/AsyncBoundary.tsx";

const TERMINAL_STATUSES = ["completed", "failed"];
const POLL_INTERVAL_MS = 1500;

// Reads a chosen file, strips the data-URL prefix, and POSTs the base64 body to the
// ingestion endpoint, then polls the job (no SSE in v1) until it reaches a terminal state.
function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Unexpected file read result"));
        return;
      }
      const commaIndex = result.indexOf(",");
      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("File read failed"));
    reader.readAsDataURL(file);
  });
}

export function UploadPage(): JSX.Element {
  const collections = useAsync(() => collectionsApi.list(), []);
  const [collectionId, setCollectionId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<IngestionJobView | null>(null);
  const [error, setError] = useState<unknown>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const upload = async (): Promise<void> => {
    setError(null);
    setJob(null);
    if (file === null) {
      setError(new Error("Choose a file first."));
      return;
    }
    try {
      const contentBase64 = await toBase64(file);
      const accepted = await ingestionApi.upload(
        collectionId,
        file.name,
        file.type === "" ? "application/octet-stream" : file.type,
        contentBase64,
      );
      setJobId(accepted.jobId);
    } catch (caught) {
      setError(caught);
    }
  };

  useEffect(() => {
    if (jobId === null) {
      return;
    }
    const poll = async (): Promise<void> => {
      try {
        const view = await ingestionApi.job(jobId);
        setJob(view);
        if (TERMINAL_STATUSES.includes(view.status) && pollRef.current !== null) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      } catch (caught) {
        setError(caught);
      }
    };
    void poll();
    pollRef.current = setInterval(() => void poll(), POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current !== null) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [jobId]);

  return (
    <section>
      <h2>Upload document</h2>
      {error !== null ? <ErrorNotice error={error} /> : null}
      <div className="card">
        <label htmlFor="upload-collection">Collection</label>
        <select id="upload-collection" value={collectionId} onChange={(event) => setCollectionId(event.target.value)}>
          <option value="">Select…</option>
          {(collections.data?.collections ?? []).map((collection) => (
            <option key={collection.id} value={collection.id}>
              {collection.name}
            </option>
          ))}
        </select>
        <label htmlFor="upload-file">File</label>
        <input
          id="upload-file"
          type="file"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />
        <button type="button" onClick={() => void upload()}>
          Upload
        </button>
      </div>

      {job !== null ? (
        <div className="card" data-testid="job-status">
          <h3>Ingestion job</h3>
          <p>
            <strong>Status:</strong> {job.status}
          </p>
          <p>
            <strong>File:</strong> {job.filename}
          </p>
          {job.createdItemId !== null ? (
            <p>
              Created item: <code>{job.createdItemId}</code>
            </p>
          ) : null}
          {job.failureReason !== null ? <p className="notice notice--error">{job.failureReason}</p> : null}
        </div>
      ) : null}
    </section>
  );
}
