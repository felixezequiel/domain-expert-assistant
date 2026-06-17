import { useState, type ReactNode } from "react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { KeyRound, RefreshCw, Trash2 } from "lucide-react";
import { collectionsApi, credentialsApi } from "../../api/resources.ts";
import { SENSITIVITY_LEVELS, type ConsumerCredentialView } from "../../api/types.ts";
import { useAsync } from "../../hooks/useAsync.ts";
import { ErrorNotice } from "../../components/AsyncBoundary.tsx";
import { TableEmptyRow, TableSkeletonRows } from "../../components/TableState.tsx";
import { SecretRevealDialog } from "../../components/SecretRevealDialog.tsx";
import { formatDateTime } from "../../lib/format.ts";
import { Badge } from "../../components/ui/badge.tsx";
import { Button } from "../../components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card.tsx";
import { Checkbox } from "../../components/ui/checkbox.tsx";
import { Label } from "../../components/ui/label.tsx";
import { Input } from "../../components/ui/input.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog.tsx";
import { toast } from "../../components/ui/sonner.tsx";

function errorMessage(caught: unknown): string {
  if (caught instanceof Error) {
    return caught.message;
  }
  return "Something went wrong.";
}

function statusBadgeVariant(status: string): "success" | "secondary" {
  if (status === "active") {
    return "success";
  }
  return "secondary";
}

function lastUsedLabel(lastUsedAt: string | null, t: TFunction): string {
  if (lastUsedAt === null) {
    return t("admin.credentials.never");
  }
  return formatDateTime(lastUsedAt);
}

function scopeLabel(collectionIds: ReadonlyArray<string>, t: TFunction): string {
  if (collectionIds.length === 0) {
    return t("admin.credentials.scopeAll");
  }
  return String(collectionIds.length);
}

export function CredentialsPage(): JSX.Element {
  const { t } = useTranslation();
  const credentials = useAsync(() => credentialsApi.list(), []);
  const collections = useAsync(() => collectionsApi.list(), []);

  const [name, setName] = useState("");
  const [collectionIds, setCollectionIds] = useState<ReadonlyArray<string>>([]);
  const [ceiling, setCeiling] = useState<string>("internal");
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<ConsumerCredentialView | null>(null);

  const issue = async (): Promise<void> => {
    try {
      const result = await credentialsApi.issue(name, collectionIds, ceiling);
      setName("");
      setCollectionIds([]);
      setCeiling("internal");
      setRevealedSecret(result.secret);
      toast.success(t("admin.credentials.toasts.issued"));
      credentials.reload();
    } catch (caught) {
      toast.error(errorMessage(caught));
    }
  };

  const rotate = async (id: string): Promise<void> => {
    try {
      const result = await credentialsApi.rotate(id);
      setRevealedSecret(result.secret);
      toast.success(t("admin.credentials.toasts.rotated"));
      credentials.reload();
    } catch (caught) {
      toast.error(errorMessage(caught));
    }
  };

  const confirmRevoke = async (): Promise<void> => {
    if (revokeTarget === null) {
      return;
    }
    try {
      await credentialsApi.revoke(revokeTarget.id);
      setRevokeTarget(null);
      toast.success(t("admin.credentials.toasts.revoked"));
      credentials.reload();
    } catch (caught) {
      setRevokeTarget(null);
      toast.error(errorMessage(caught));
    }
  };

  const toggleCollection = (id: string): void => {
    setCollectionIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  };

  const rows = credentials.data?.credentials ?? [];
  const availableCollections = collections.data?.collections ?? [];

  const COLUMN_COUNT = 7;
  let tableBody: ReactNode;
  if (credentials.loading) {
    tableBody = <TableSkeletonRows columns={COLUMN_COUNT} />;
  } else if (rows.length === 0) {
    tableBody = <TableEmptyRow columns={COLUMN_COUNT}>{t("admin.credentials.empty")}</TableEmptyRow>;
  } else {
    tableBody = rows.map((credential) => (
      <TableRow key={credential.id}>
        <TableCell className="font-medium">{credential.name}</TableCell>
        <TableCell>
          <code className="font-mono text-xs text-muted-foreground">{credential.keyPrefix}</code>
        </TableCell>
        <TableCell>{scopeLabel(credential.collectionIds, t)}</TableCell>
        <TableCell>{t("common.sensitivity." + credential.sensitivityCeiling)}</TableCell>
        <TableCell>
          <Badge variant={statusBadgeVariant(credential.status)}>
            {t("admin.credentials.status." + credential.status)}
          </Badge>
        </TableCell>
        <TableCell>{lastUsedLabel(credential.lastUsedAt, t)}</TableCell>
        <TableCell>
          <CredentialActions credential={credential} onRotate={rotate} onRevoke={setRevokeTarget} />
        </TableCell>
      </TableRow>
    ));
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("admin.credentials.title")}</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("admin.credentials.issueCard")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="cred-name">{t("admin.credentials.nameLabel")}</Label>
            <Input id="cred-name" value={name} onChange={(event) => setName(event.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>{t("admin.credentials.scopedCollectionsLabel")}</Label>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {availableCollections.map((collection) => (
                <label
                  key={collection.id}
                  className="flex cursor-pointer items-center gap-2 text-sm"
                >
                  <Checkbox
                    checked={collectionIds.includes(collection.id)}
                    onCheckedChange={() => toggleCollection(collection.id)}
                  />
                  {collection.name}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cred-ceiling">{t("admin.credentials.ceilingLabel")}</Label>
            <Select value={ceiling} onValueChange={setCeiling}>
              <SelectTrigger id="cred-ceiling" className="sm:w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SENSITIVITY_LEVELS.map((level) => (
                  <SelectItem key={level} value={level}>
                    {t("common.sensitivity." + level)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button type="button" onClick={() => void issue()} disabled={name === ""}>
            <KeyRound className="mr-2 h-4 w-4" />
            {t("admin.credentials.issue")}
          </Button>
        </CardContent>
      </Card>

      {credentials.error !== null ? <ErrorNotice error={credentials.error} /> : null}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("admin.credentials.columns.name")}</TableHead>
                <TableHead>{t("admin.credentials.columns.prefix")}</TableHead>
                <TableHead>{t("admin.credentials.columns.scope")}</TableHead>
                <TableHead>{t("admin.credentials.columns.ceiling")}</TableHead>
                <TableHead>{t("admin.credentials.columns.status")}</TableHead>
                <TableHead>{t("admin.credentials.columns.lastUsed")}</TableHead>
                <TableHead className="w-0" />
              </TableRow>
            </TableHeader>
            <TableBody>{tableBody}</TableBody>
          </Table>
        </CardContent>
      </Card>

      {revealedSecret !== null ? (
        <SecretRevealDialog secret={revealedSecret} onClose={() => setRevealedSecret(null)} />
      ) : null}

      <Dialog
        open={revokeTarget !== null}
        onOpenChange={(next) => {
          if (!next) {
            setRevokeTarget(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("admin.credentials.revokeTitle")}</DialogTitle>
            <DialogDescription>{t("admin.credentials.revokeDescription")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRevokeTarget(null)}>
              {t("common.actions.cancel")}
            </Button>
            <Button type="button" variant="destructive" onClick={() => void confirmRevoke()}>
              {t("admin.credentials.revoke")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CredentialActions({
  credential,
  onRotate,
  onRevoke,
}: {
  readonly credential: ConsumerCredentialView;
  onRotate(id: string): void;
  onRevoke(credential: ConsumerCredentialView): void;
}): JSX.Element | null {
  const { t } = useTranslation();
  if (credential.status !== "active") {
    return null;
  }
  return (
    <div className="flex gap-2">
      <Button type="button" variant="outline" size="sm" onClick={() => onRotate(credential.id)}>
        <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
        {t("admin.credentials.rotate")}
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={() => onRevoke(credential)}>
        <Trash2 className="mr-1.5 h-3.5 w-3.5" />
        {t("admin.credentials.revoke")}
      </Button>
    </div>
  );
}
