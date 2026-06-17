import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Copy, Loader2, UserPlus } from "lucide-react";
import { usersApi } from "../../api/resources.ts";
import { ROLES, type InvitedUser, type OrgUser } from "../../api/types.ts";
import { useAuth } from "../../auth/AuthContext.tsx";
import { useAsync } from "../../hooks/useAsync.ts";
import { ErrorNotice } from "../../components/AsyncBoundary.tsx";
import { TableEmptyRow, TableSkeletonRows } from "../../components/TableState.tsx";
import { Badge } from "../../components/ui/badge.tsx";
import { Button } from "../../components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card.tsx";
import { Checkbox } from "../../components/ui/checkbox.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog.tsx";
import { Input } from "../../components/ui/input.tsx";
import { Label } from "../../components/ui/label.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table.tsx";
import { toast } from "../../components/ui/sonner.tsx";

function errorMessage(caught: unknown): string {
  return caught instanceof Error ? caught.message : "Something went wrong.";
}

function toggleRole(roles: ReadonlyArray<string>, role: string): ReadonlyArray<string> {
  if (roles.includes(role)) {
    return roles.filter((value) => value !== role);
  }
  return [...roles, role];
}

function statusVariant(status: string): "outline" | "secondary" {
  if (status === "active") {
    return "outline";
  }
  return "secondary";
}

// Admin user management. A roster of existing users drives the per-row role/disable
// flows; the invite form surfaces the generated invitation token so an admin can hand
// the invitee a ready-to-use accept link.
export function UsersPage(): JSX.Element {
  const { t } = useTranslation();
  const { session } = useAuth();
  const orgId = session?.user.companyId ?? "";

  const roster = useAsync(() => usersApi.list(orgId), [orgId]);

  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [inviteRoles, setInviteRoles] = useState<ReadonlyArray<string>>(["consumer"]);
  const [inviting, setInviting] = useState(false);
  const [invited, setInvited] = useState<InvitedUser | null>(null);

  const [editing, setEditing] = useState<OrgUser | null>(null);
  const [editRoles, setEditRoles] = useState<ReadonlyArray<string>>([]);
  const [savingRoles, setSavingRoles] = useState(false);

  const [disabling, setDisabling] = useState<OrgUser | null>(null);
  const [disablingBusy, setDisablingBusy] = useState(false);

  const acceptUrl = invited !== null ? `${location.origin}/#/invitations/${invited.invitationToken}` : "";

  const rosterUsers = roster.data?.users ?? [];

  const ROSTER_COLUMN_COUNT = 5;
  let tableBody: ReactNode;
  if (roster.loading) {
    tableBody = <TableSkeletonRows columns={ROSTER_COLUMN_COUNT} />;
  } else if (rosterUsers.length === 0) {
    tableBody = <TableEmptyRow columns={ROSTER_COLUMN_COUNT}>{t("admin.users.empty")}</TableEmptyRow>;
  } else {
    tableBody = rosterUsers.map((user) => (
      <TableRow key={user.id}>
        <TableCell className="font-medium">{user.email}</TableCell>
        <TableCell>{user.displayName}</TableCell>
        <TableCell>
          <div className="flex flex-wrap gap-1">
            {user.roles.map((role) => (
              <Badge key={role} variant="secondary">
                {t("common.roles." + role)}
              </Badge>
            ))}
          </div>
        </TableCell>
        <TableCell>
          <Badge variant={statusVariant(user.status)}>{t("admin.users.status." + user.status)}</Badge>
        </TableCell>
        <TableCell className="text-right">
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => openEdit(user)}>
              {t("admin.users.editRoles")}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDisabling(user)}
              disabled={user.status !== "active"}
            >
              {t("admin.users.disable")}
            </Button>
          </div>
        </TableCell>
      </TableRow>
    ));
  }

  const invite = async (): Promise<void> => {
    setInviting(true);
    try {
      const result = await usersApi.invite(orgId, email, displayName, inviteRoles);
      setInvited(result);
      setEmail("");
      setDisplayName("");
      setInviteRoles(["consumer"]);
      roster.reload();
      toast.success(t("admin.users.toasts.invited"));
    } catch (caught) {
      toast.error(errorMessage(caught));
    } finally {
      setInviting(false);
    }
  };

  const copyAcceptUrl = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(acceptUrl);
      toast.success(t("admin.users.toasts.linkCopied"));
    } catch (caught) {
      toast.error(errorMessage(caught));
    }
  };

  const openEdit = (user: OrgUser): void => {
    setEditing(user);
    setEditRoles(user.roles);
  };

  const onEditOpenChange = (open: boolean): void => {
    if (!open) {
      setEditing(null);
    }
  };

  const onDisableOpenChange = (open: boolean): void => {
    if (!open) {
      setDisabling(null);
    }
  };

  const saveRoles = async (): Promise<void> => {
    if (editing === null) {
      return;
    }
    setSavingRoles(true);
    try {
      await usersApi.changeRoles(editing.id, editRoles);
      setEditing(null);
      roster.reload();
      toast.success(t("admin.users.toasts.rolesUpdated"));
    } catch (caught) {
      toast.error(errorMessage(caught));
    } finally {
      setSavingRoles(false);
    }
  };

  const confirmDisable = async (): Promise<void> => {
    if (disabling === null) {
      return;
    }
    setDisablingBusy(true);
    try {
      await usersApi.disable(disabling.id);
      setDisabling(null);
      roster.reload();
      toast.success(t("admin.users.toasts.disabled"));
    } catch (caught) {
      toast.error(errorMessage(caught));
    } finally {
      setDisablingBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("admin.users.title")}</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("admin.users.inviteCard")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="invite-email">{t("admin.users.emailLabel")}</Label>
              <Input
                id="invite-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invite-name">{t("admin.users.displayNameLabel")}</Label>
              <Input
                id="invite-name"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t("admin.users.rolesLabel")}</Label>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {ROLES.map((role) => (
                <label key={role} className="flex cursor-pointer items-center gap-2 text-sm">
                  <Checkbox
                    checked={inviteRoles.includes(role)}
                    onCheckedChange={() => setInviteRoles((current) => toggleRole(current, role))}
                  />
                  {t("common.roles." + role)}
                </label>
              ))}
            </div>
          </div>

          <Button type="button" onClick={() => void invite()} disabled={inviting}>
            {inviting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
            {t("admin.users.invite")}
          </Button>

          {invited !== null ? (
            <div className="space-y-2 rounded-md border border-border bg-muted/30 px-3 py-3 text-sm">
              <p className="break-all">
                {t("admin.users.invitationToken")}{" "}
                <code className="font-mono" data-testid="invitation-token">
                  {invited.invitationToken}
                </code>
              </p>
              <Button type="button" variant="secondary" size="sm" onClick={() => void copyAcceptUrl()}>
                <Copy className="mr-2 h-4 w-4" />
                {t("admin.users.copyAcceptLink")}
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("admin.users.rosterCard")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {roster.error !== null ? <ErrorNotice error={roster.error} /> : null}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("admin.users.columns.email")}</TableHead>
                <TableHead>{t("admin.users.columns.displayName")}</TableHead>
                <TableHead>{t("admin.users.columns.roles")}</TableHead>
                <TableHead>{t("admin.users.columns.status")}</TableHead>
                <TableHead className="text-right">{t("admin.users.columns.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>{tableBody}</TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={editing !== null} onOpenChange={onEditOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("admin.users.editRoles")}</DialogTitle>
            <DialogDescription>{editing?.email}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {ROLES.map((role) => (
              <label key={role} className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox
                  checked={editRoles.includes(role)}
                  onCheckedChange={() => setEditRoles((current) => toggleRole(current, role))}
                />
                {t("common.roles." + role)}
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setEditing(null)} disabled={savingRoles}>
              {t("common.actions.cancel")}
            </Button>
            <Button type="button" onClick={() => void saveRoles()} disabled={savingRoles}>
              {savingRoles ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("common.actions.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={disabling !== null} onOpenChange={onDisableOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("admin.users.disableTitle")}</DialogTitle>
            <DialogDescription>
              {t("admin.users.disableDescription", { email: disabling?.email ?? "" })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setDisabling(null)} disabled={disablingBusy}>
              {t("common.actions.cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void confirmDisable()}
              disabled={disablingBusy}
            >
              {disablingBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("admin.users.disable")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
