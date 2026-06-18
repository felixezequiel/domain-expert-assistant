import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { CheckCircle2, Loader2, Upload } from "lucide-react";
import { collectionsApi, ingestionApi } from "../../api/resources.ts";
import type { IngestionJobView } from "../../api/types.ts";
import { useAsync } from "../../hooks/useAsync.ts";
import { ErrorNotice } from "../../components/AsyncBoundary.tsx";
import { FileDropzone } from "../../components/FileDropzone.tsx";
import { Button } from "../../components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card.tsx";
import { Label } from "../../components/ui/label.tsx";
import { TaxonomyCombobox, type TaxonomyOption } from "../../components/TaxonomyCombobox.tsx";
import { Skeleton } from "../../components/ui/skeleton.tsx";

// Ingestion job lifecycle is pending -> processing -> done | failed (IngestionJob aggregate).
const TERMINAL_STATUSES = ["done", "failed"];
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
  const { t } = useTranslation();
  const collections = useAsync(() => collectionsApi.list(), []);
  const [collectionId, setCollectionId] = useState("");
  const [createdCollections, setCreatedCollections] = useState<ReadonlyArray<TaxonomyOption>>([]);
  const [file, setFile] = useState<File | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<IngestionJobView | null>(null);
  const [error, setError] = useState<unknown>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const processing = jobId !== null && (job === null || !TERMINAL_STATUSES.includes(job.status));

  const collectionOptions: ReadonlyArray<TaxonomyOption> = [
    ...(collections.data?.collections ?? []).map((collection) => ({ value: collection.id, label: collection.name })),
    ...createdCollections,
  ];

  const createCollection = async (name: string): Promise<TaxonomyOption> => {
    const created = await collectionsApi.create(name);
    const option = { value: created.id, label: created.name };
    setCreatedCollections((current) => [...current, option]);
    return option;
  };

  const upload = async (): Promise<void> => {
    setError(null);
    setJob(null);
    if (file === null) {
      setError(new Error(t("knowledge.upload.chooseFileFirst")));
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("knowledge.upload.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("knowledge.upload.subtitle")}</p>
      </div>

      {error !== null ? <ErrorNotice error={error} /> : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("knowledge.upload.newIngestion")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="upload-collection">{t("knowledge.upload.collectionLabel")}</Label>
            <div className="sm:w-72">
              <TaxonomyCombobox
                id="upload-collection"
                ariaLabel={t("knowledge.upload.collectionLabel")}
                options={collectionOptions}
                value={collectionId}
                onChange={setCollectionId}
                onCreate={createCollection}
                disabled={processing}
                placeholder={t("knowledge.upload.collectionPlaceholder")}
                searchPlaceholder={t("knowledge.editor.collectionSearch")}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="upload-file">{t("knowledge.upload.fileLabel")}</Label>
            <FileDropzone
              id="upload-file"
              file={file}
              onFileChange={setFile}
              hint={t("knowledge.upload.dropzoneHint")}
              disabled={processing}
            />
          </div>

          <Button type="button" onClick={() => void upload()} disabled={file === null || processing}>
            {processing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            {t("knowledge.upload.uploadButton")}
          </Button>
        </CardContent>
      </Card>

      {processing ? (
        <Card data-testid="job-status">
          <CardContent className="space-y-3 py-5">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              {t("knowledge.upload.processing")}
            </div>
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
          </CardContent>
        </Card>
      ) : null}

      {job !== null && job.status === "done" ? (
        <Card data-testid="job-status" className="border-success/40">
          <CardContent className="space-y-2 py-5">
            <div className="flex items-center gap-2 text-sm font-medium text-success">
              <CheckCircle2 className="h-4 w-4" />
              {t("knowledge.upload.complete")}
            </div>
            <p className="text-sm text-muted-foreground">
              {t("knowledge.upload.createdFrom", { filename: job.filename })}
            </p>
            {job.createdItemId !== null ? (
              <Button asChild variant="outline" size="sm">
                <Link to={`/items/${job.createdItemId}`}>{t("knowledge.upload.openCreatedItem")}</Link>
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {job !== null && job.status === "failed" ? (
        <div
          data-testid="job-status"
          role="alert"
          className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm"
        >
          <span>
            <span className="font-medium">{t("knowledge.upload.failed")}</span>{" "}
            {job.failureReason ?? t("knowledge.upload.unknownError")}
          </span>
        </div>
      ) : null}
    </div>
  );
}
