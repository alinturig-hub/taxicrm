"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

type Role = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isSystem: boolean;
};

type UserRole = {
  assignedAt: string;
  role: Role & {
    isActive?: boolean;
  };
};

type AdministrationUser = {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  passwordChangedAt?: string | null;
  deactivatedAt: string | null;
  createdAt: string;
  updatedAt: string;
  roleAssignments: UserRole[];
};

type UsersResponse = {
  success: boolean;
  users: AdministrationUser[];
  roles: Role[];
  currentUser: {
    id: string;
    isSuperAdmin: boolean;
    canManage: boolean;
  };
  message?: string;
};

const dateFormatter =
  new Intl.DateTimeFormat(
    "en-GB",
    {
      timeZone: "Europe/London",
      dateStyle: "medium",
      timeStyle: "short",
    },
  );

function formatDate(
  value: string | null,
) {
  return value
    ? dateFormatter.format(
        new Date(value),
      )
    : "Never";
}

export default function UsersAdministration() {
  const [data, setData] =
    useState<UsersResponse | null>(null);
  const [loading, setLoading] =
    useState(true);
  const [saving, setSaving] =
    useState(false);
  const [error, setError] =
    useState<string | null>(null);
  const [notice, setNotice] =
    useState<string | null>(null);
  const [showCreate, setShowCreate] =
    useState(false);
  const [name, setName] =
    useState("");
  const [email, setEmail] =
    useState("");
  const [
    temporaryPassword,
    setTemporaryPassword,
  ] = useState("");
  const [
    createRoleIds,
    setCreateRoleIds,
  ] = useState<string[]>([]);
  const [
    editingUserId,
    setEditingUserId,
  ] = useState<string | null>(null);
  const [
    editingRoleIds,
    setEditingRoleIds,
  ] = useState<string[]>([]);

  const loadUsers =
    useCallback(async () => {
      try {
        setError(null);

        const response = await fetch(
          "/api/dashboard/administration/users",
          {
            cache: "no-store",
          },
        );

        const payload =
          (await response.json()) as
            UsersResponse;

        if (
          !response.ok ||
          !payload.success
        ) {
          throw new Error(
            payload.message ??
              "Users could not be loaded.",
          );
        }

        setData(payload);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Users could not be loaded.",
        );
      } finally {
        setLoading(false);
      }
    }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const activeUsers =
    useMemo(
      () =>
        data?.users.filter(
          (user) => user.isActive,
        ).length ?? 0,
      [data],
    );

  function toggleRole(
    roleId: string,
    selected: string[],
    setSelected:
      (value: string[]) => void,
  ) {
    setSelected(
      selected.includes(roleId)
        ? selected.filter(
            (id) => id !== roleId,
          )
        : [...selected, roleId],
    );
  }

  async function createUser(
    event: FormEvent,
  ) {
    event.preventDefault();

    if (createRoleIds.length === 0) {
      setError(
        "Select at least one role.",
      );
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch(
        "/api/dashboard/administration/users",
        {
          method: "POST",
          headers: {
            "content-type":
              "application/json",
          },
          body: JSON.stringify({
            name,
            email,
            temporaryPassword,
            roleIds: createRoleIds,
          }),
        },
      );

      const payload =
        (await response.json()) as {
          success: boolean;
          message?: string;
          error?: string;
        };

      if (
        !response.ok ||
        !payload.success
      ) {
        throw new Error(
          payload.message ??
            payload.error ??
            "User could not be created.",
        );
      }

      setName("");
      setEmail("");
      setTemporaryPassword("");
      setCreateRoleIds([]);
      setShowCreate(false);
      setNotice(
        "User created. They must change the temporary password.",
      );
      await loadUsers();
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "User could not be created.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function updateUser(
    userId: string,
    update: {
      isActive?: boolean;
      roleIds?: string[];
    },
  ) {
    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch(
        `/api/dashboard/administration/users/${userId}`,
        {
          method: "PATCH",
          headers: {
            "content-type":
              "application/json",
          },
          body: JSON.stringify(update),
        },
      );

      const payload =
        (await response.json()) as {
          success: boolean;
          message?: string;
          error?: string;
        };

      if (
        !response.ok ||
        !payload.success
      ) {
        throw new Error(
          payload.message ??
            payload.error ??
            "User could not be updated.",
        );
      }

      setEditingUserId(null);
      setEditingRoleIds([]);
      setNotice(
        "User access updated.",
      );
      await loadUsers();
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "User could not be updated.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function resetPassword(
    user: AdministrationUser,
  ) {
    const password =
      window.prompt(
        `Enter a temporary password for ${user.name}. Minimum 12 characters.`,
      );

    if (password === null) {
      return;
    }

    if (password.length < 12) {
      setError(
        "The temporary password must contain at least 12 characters.",
      );
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch(
        `/api/dashboard/administration/users/${user.id}/reset-password`,
        {
          method: "POST",
          headers: {
            "content-type":
              "application/json",
          },
          body: JSON.stringify({
            temporaryPassword:
              password,
          }),
        },
      );

      const payload =
        (await response.json()) as {
          success: boolean;
          message?: string;
          error?: string;
        };

      if (
        !response.ok ||
        !payload.success
      ) {
        throw new Error(
          payload.message ??
            payload.error ??
            "Password could not be reset.",
        );
      }

      setNotice(
        "Temporary password set. It was not stored in the audit log.",
      );
      await loadUsers();
    } catch (resetError) {
      setError(
        resetError instanceof Error
          ? resetError.message
          : "Password could not be reset.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading && !data) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 text-sm text-slate-400">
        Loading users…
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-rose-200">
        {error ??
          "Users are unavailable."}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-400">
              Administration
            </p>
            <h1 className="mt-3 text-3xl font-bold text-white">
              Users
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
              Create accounts, control active access,
              assign roles and review login activity.
              Password hashes are never exposed.
            </p>
          </div>

          {data.currentUser.canManage ? (
            <button
              type="button"
              onClick={() =>
                setShowCreate(
                  (current) => !current,
                )
              }
              className="rounded-xl border border-blue-500/30 bg-blue-500/10 px-5 py-3 text-sm font-semibold text-blue-300 hover:bg-blue-500/20"
            >
              {showCreate
                ? "Close form"
                : "Create user"}
            </button>
          ) : null}
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <Summary
            label="Total users"
            value={String(
              data.users.length,
            )}
          />
          <Summary
            label="Active users"
            value={String(activeUsers)}
          />
          <Summary
            label="Available roles"
            value={String(
              data.roles.length,
            )}
          />
        </div>
      </section>

      {error ? (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      {notice ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {notice}
        </div>
      ) : null}

      {showCreate ? (
        <form
          onSubmit={createUser}
          className="rounded-2xl border border-blue-500/20 bg-slate-900 p-6"
        >
          <h2 className="text-xl font-bold text-white">
            Create user
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            The user receives a temporary password and
            must replace it after signing in.
          </p>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <Field
              label="Full name"
              value={name}
              onChange={setName}
              autoComplete="name"
            />
            <Field
              label="Email"
              value={email}
              onChange={setEmail}
              type="email"
              autoComplete="email"
            />
            <Field
              label="Temporary password"
              value={temporaryPassword}
              onChange={
                setTemporaryPassword
              }
              type="password"
              autoComplete="new-password"
            />
          </div>

          <RoleSelector
            roles={data.roles}
            selected={createRoleIds}
            disabled={!data.currentUser.isSuperAdmin}
            onToggle={(roleId) =>
              toggleRole(
                roleId,
                createRoleIds,
                setCreateRoleIds,
              )
            }
          />

          <button
            type="submit"
            disabled={saving}
            className="mt-5 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {saving
              ? "Creating…"
              : "Create user"}
          </button>
        </form>
      ) : null}

      <section className="space-y-4">
        {data.users.map((user) => {
          const isCurrent =
            user.id ===
            data.currentUser.id;
          const editing =
            editingUserId === user.id;

          return (
            <article
              key={user.id}
              className="rounded-2xl border border-slate-800 bg-slate-900 p-5"
            >
              <div className="flex flex-col justify-between gap-5 xl:flex-row xl:items-start">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-lg font-semibold text-white">
                      {user.name}
                    </h2>
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                        user.isActive
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                          : "border-slate-700 bg-slate-800 text-slate-400"
                      }`}
                    >
                      {user.isActive
                        ? "ACTIVE"
                        : "INACTIVE"}
                    </span>
                    {isCurrent ? (
                      <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-300">
                        YOU
                      </span>
                    ) : null}
                    {user.mustChangePassword ? (
                      <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-300">
                        PASSWORD CHANGE REQUIRED
                      </span>
                    ) : null}
                  </div>

                  <p className="mt-2 text-sm text-slate-400">
                    {user.email}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {user.roleAssignments.map(
                      (assignment) => (
                        <span
                          key={
                            assignment.role.id
                          }
                          className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1 text-xs text-slate-300"
                        >
                          {
                            assignment.role
                              .name
                          }
                        </span>
                      ),
                    )}
                  </div>

                  <div className="mt-4 grid gap-2 text-xs text-slate-500 sm:grid-cols-2">
                    <p>
                      Last login:{" "}
                      {formatDate(
                        user.lastLoginAt,
                      )}
                    </p>
                    <p>
                      Created:{" "}
                      {formatDate(
                        user.createdAt,
                      )}
                    </p>
                  </div>
                </div>

                {data.currentUser.canManage ? (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => {
                        setEditingUserId(
                          editing
                            ? null
                            : user.id,
                        );
                        setEditingRoleIds(
                          user.roleAssignments.map(
                            (assignment) =>
                              assignment.role.id,
                          ),
                        );
                      }}
                      className="rounded-lg border border-blue-500/30 px-3 py-2 text-xs font-semibold text-blue-300"
                    >
                      {editing
                        ? "Cancel roles"
                        : "Edit roles"}
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() =>
                        void resetPassword(
                          user,
                        )
                      }
                      className="rounded-lg border border-amber-500/30 px-3 py-2 text-xs font-semibold text-amber-300"
                    >
                      Reset password
                    </button>
                    <button
                      type="button"
                      disabled={
                        saving || isCurrent
                      }
                      onClick={() =>
                        void updateUser(
                          user.id,
                          {
                            isActive:
                              !user.isActive,
                          },
                        )
                      }
                      className={`rounded-lg border px-3 py-2 text-xs font-semibold ${
                        user.isActive
                          ? "border-rose-500/30 text-rose-300"
                          : "border-emerald-500/30 text-emerald-300"
                      } disabled:opacity-40`}
                    >
                      {user.isActive
                        ? "Deactivate"
                        : "Activate"}
                    </button>
                  </div>
                ) : null}
              </div>

              {editing ? (
                <div className="mt-5 border-t border-slate-800 pt-5">
                  <RoleSelector
                    roles={data.roles}
                    selected={
                      editingRoleIds
                    }
                    disabled={
                      !data.currentUser
                        .isSuperAdmin
                    }
                    onToggle={(roleId) =>
                      toggleRole(
                        roleId,
                        editingRoleIds,
                        setEditingRoleIds,
                      )
                    }
                  />
                  <button
                    type="button"
                    disabled={
                      saving ||
                      editingRoleIds.length ===
                        0
                    }
                    onClick={() =>
                      void updateUser(
                        user.id,
                        {
                          roleIds:
                            editingRoleIds,
                        },
                      )
                    }
                    className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    Save roles
                  </button>
                </div>
              ) : null}
            </article>
          );
        })}
      </section>
    </div>
  );
}

function Summary({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-4">
      <p className="text-xs uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold text-white">
        {value}
      </p>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  autoComplete: string;
}) {
  return (
    <label className="text-sm text-slate-300">
      {label}
      <input
        required
        type={type}
        value={value}
        autoComplete={autoComplete}
        minLength={
          type === "password"
            ? 12
            : undefined
        }
        onChange={(event) =>
          onChange(
            event.target.value,
          )
        }
        className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-blue-500"
      />
    </label>
  );
}

function RoleSelector({
  roles,
  selected,
  disabled,
  onToggle,
}: {
  roles: Role[];
  selected: string[];
  disabled: boolean;
  onToggle: (roleId: string) => void;
}) {
  return (
    <div className="mt-5">
      <p className="text-sm font-semibold text-white">
        Roles
      </p>
      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {roles.map((role) => {
          const superAdmin =
            role.key === "SUPER_ADMIN";
          const roleDisabled =
            superAdmin && disabled;

          return (
            <label
              key={role.id}
              className={`rounded-xl border p-4 ${
                selected.includes(role.id)
                  ? "border-blue-500/40 bg-blue-500/10"
                  : "border-slate-800 bg-slate-950/30"
              } ${
                roleDisabled
                  ? "opacity-50"
                  : "cursor-pointer"
              }`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={selected.includes(
                    role.id,
                  )}
                  disabled={roleDisabled}
                  onChange={() =>
                    onToggle(role.id)
                  }
                  className="mt-1"
                />
                <div>
                  <p className="font-semibold text-white">
                    {role.name}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-400">
                    {role.description ??
                      role.key}
                  </p>
                </div>
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}
