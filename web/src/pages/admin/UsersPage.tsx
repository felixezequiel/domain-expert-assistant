import { useState } from "react";
import { usersApi } from "../../api/resources.ts";
import { ROLES, type InvitedUser } from "../../api/types.ts";
import { useAuth } from "../../auth/AuthContext.tsx";
import { ErrorNotice } from "../../components/AsyncBoundary.tsx";

// Admin user management. The backend exposes no "list users" endpoint, so this screen
// drives the write flows (invite / change roles / disable) by user id; the invite flow
// surfaces the generated invitation token so an admin can hand it to the invitee.
export function UsersPage(): JSX.Element {
  const { session } = useAuth();
  const orgId = session?.companyId ?? "";

  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [inviteRoles, setInviteRoles] = useState<ReadonlyArray<string>>(["consumer"]);
  const [invited, setInvited] = useState<InvitedUser | null>(null);

  const [roleUserId, setRoleUserId] = useState("");
  const [newRoles, setNewRoles] = useState<ReadonlyArray<string>>(["consumer"]);
  const [disableUserId, setDisableUserId] = useState("");

  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const run = async (action: () => Promise<string>): Promise<void> => {
    setError(null);
    setNotice(null);
    try {
      setNotice(await action());
    } catch (caught) {
      setError(caught);
    }
  };

  const invite = (): Promise<void> =>
    run(async () => {
      const result = await usersApi.invite(orgId, email, displayName, inviteRoles);
      setInvited(result);
      return `Invited ${email}.`;
    });

  const changeRoles = (): Promise<void> =>
    run(async () => {
      await usersApi.changeRoles(roleUserId, newRoles);
      return `Updated roles for ${roleUserId}.`;
    });

  const disable = (): Promise<void> =>
    run(async () => {
      await usersApi.disable(disableUserId);
      return `Disabled ${disableUserId}.`;
    });

  return (
    <section>
      <h2>Users &amp; roles</h2>
      {error !== null ? <ErrorNotice error={error} /> : null}
      {notice !== null ? <p className="notice notice--ok">{notice}</p> : null}

      <div className="card">
        <h3>Invite user</h3>
        <label htmlFor="invite-email">Email</label>
        <input id="invite-email" value={email} onChange={(event) => setEmail(event.target.value)} />
        <label htmlFor="invite-name">Display name</label>
        <input id="invite-name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
        <RoleCheckboxes selected={inviteRoles} onChange={setInviteRoles} idPrefix="invite" />
        <button type="button" onClick={() => void invite()}>
          Invite
        </button>
        {invited !== null ? (
          <p className="notice notice--ok">
            User id: <code>{invited.userId}</code> — invitation token:{" "}
            <code data-testid="invitation-token">{invited.invitationToken}</code>
          </p>
        ) : null}
      </div>

      <div className="card">
        <h3>Change roles</h3>
        <label htmlFor="role-user">User id</label>
        <input id="role-user" value={roleUserId} onChange={(event) => setRoleUserId(event.target.value)} />
        <RoleCheckboxes selected={newRoles} onChange={setNewRoles} idPrefix="change" />
        <button type="button" onClick={() => void changeRoles()}>
          Save roles
        </button>
      </div>

      <div className="card">
        <h3>Disable user</h3>
        <label htmlFor="disable-user">User id</label>
        <input id="disable-user" value={disableUserId} onChange={(event) => setDisableUserId(event.target.value)} />
        <button type="button" onClick={() => void disable()}>
          Disable
        </button>
      </div>
    </section>
  );
}

function RoleCheckboxes({
  selected,
  onChange,
  idPrefix,
}: {
  readonly selected: ReadonlyArray<string>;
  onChange(next: ReadonlyArray<string>): void;
  readonly idPrefix: string;
}): JSX.Element {
  const toggle = (role: string): void => {
    if (selected.includes(role)) {
      onChange(selected.filter((value) => value !== role));
    } else {
      onChange([...selected, role]);
    }
  };
  return (
    <fieldset className="roles">
      <legend>Roles</legend>
      {ROLES.map((role) => (
        <label key={role} htmlFor={`${idPrefix}-${role}`}>
          <input
            id={`${idPrefix}-${role}`}
            type="checkbox"
            checked={selected.includes(role)}
            onChange={() => toggle(role)}
          />
          {role}
        </label>
      ))}
    </fieldset>
  );
}
