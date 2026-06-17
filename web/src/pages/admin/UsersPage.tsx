import { useState } from "react";
import { Copy, Loader2, UserPlus } from "lucide-react";
import { usersApi } from "../../api/resources.ts";
import { ROLES, type InvitedUser, type OrgUser } from "../../api/types.ts";
import { useAuth } from "../../auth/AuthContext.tsx";
import { useAsync } from "../../hooks/useAsync.ts";
import { AsyncBoundary } from "../../components/AsyncBoundary.tsx";
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

  const invite = async (): Promise<void> => {
    setInviting(true);
    try {
      const result = await usersApi.invite(orgId, email, displayName, inviteRoles);
      setInvited(result);
      setEmail("");
      setDisplayName("");
      setInviteRoles(["consumer"]);
      roster.reload();
      toast.success("Invitation sent");
    } catch (caught) {
      toast.error(errorMessage(caught));
    } finally {
      setInviting(false);
    }
  };

  const copyAcceptUrl = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(acceptUrl);
      toast.success("Accept link copied");
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
      toast.success("Roles updated");
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
      toast.success("User disabled");
    } catch (caught) {
      toast.error(errorMessage(caught));
    } finally {
      setDisablingBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Users &amp; roles</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Invite user</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invite-name">Display name</Label>
              <Input
                id="invite-name"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Roles</Label>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {ROLES.map((role) => (
                <label key={role} className="flex cursor-pointer items-center gap-2 text-sm">
                  <Checkbox
                    checked={inviteRoles.includes(role)}
                    onCheckedChange={() => setInviteRoles((current) => toggleRole(current, role))}
                  />
                  {role}
                </label>
              ))}
            </div>
          </div>

          <Button type="button" onClick={() => void invite()} disabled={inviting}>
            {inviting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
            Invite
          </Button>

          {invited !== null ? (
            <div className="space-y-2 rounded-md border border-border bg-muted/30 px-3 py-3 text-sm">
              <p>
                User id: <code className="font-mono">{invited.userId}</code>
              </p>
              <p className="break-all">
                Invitation token:{" "}
                <code className="font-mono" data-testid="invitation-token">
                  {invited.invitationToken}
                </code>
              </p>
              <Button type="button" variant="secondary" size="sm" onClick={() => void copyAcceptUrl()}>
                <Copy className="mr-2 h-4 w-4" />
                Copy accept link
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Roster</CardTitle>
        </CardHeader>
        <CardContent>
          <AsyncBoundary loading={roster.loading} error={roster.error}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Display name</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(roster.data?.users ?? []).map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.email}</TableCell>
                    <TableCell>{user.displayName}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {user.roles.map((role) => (
                          <Badge key={role} variant="secondary">
                            {role}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(user.status)}>{user.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => openEdit(user)}>
                          Edit roles
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setDisabling(user)}
                          disabled={user.status !== "active"}
                        >
                          Disable
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </AsyncBoundary>
        </CardContent>
      </Card>

      <Dialog open={editing !== null} onOpenChange={onEditOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit roles</DialogTitle>
            <DialogDescription>{editing?.email}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {ROLES.map((role) => (
              <label key={role} className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox
                  checked={editRoles.includes(role)}
                  onCheckedChange={() => setEditRoles((current) => toggleRole(current, role))}
                />
                {role}
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setEditing(null)} disabled={savingRoles}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void saveRoles()} disabled={savingRoles}>
              {savingRoles ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={disabling !== null} onOpenChange={onDisableOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disable user</DialogTitle>
            <DialogDescription>
              Disabling {disabling?.email} will revoke their access until re-enabled.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setDisabling(null)} disabled={disablingBusy}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void confirmDisable()}
              disabled={disablingBusy}
            >
              {disablingBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Disable
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
