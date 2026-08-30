"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

type Permission = {
  id: string;
  key: string;
  module: string;
  action: string;
  name: string;
  description: string | null;
};

type Role = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count: {
    users: number;
  };
  permissions: Array<{
    permission: Permission;
  }>;
};

type RolesResponse = {
  success: boolean;
  roles: Role[];
  permissions: Permission[];
  currentUser: {
    id: string;
    isSuperAdmin: boolean;
    canManage: boolean;
  };
  message?: string;
};

export default function RolesAdministration() {
  const [data, setData] =
    useState<RolesResponse | null>(null);
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
  const [description, setDescription] =
    useState("");
  const [
    createPermissionIds,
    setCreatePermissionIds,
  ] = useState<string[]>([]);
  const [
    editingRoleId,
    setEditingRoleId,
  ] = useState<string | null>(null);
  const [
    editingPermissionIds,
    setEditingPermissionIds,
  ] = useState<string[]>([]);

  const loadRoles =
    useCallback(async () => {
      try {
        setError(null);

        const response = await fetch(
          "/api/dashboard/administration/roles",
          {
            cache: "no-store",
          },
        );

        const payload =
          (await response.json()) as
            RolesResponse;

        if (
          !response.ok ||
          !payload.success
        ) {
          throw new Error(
            payload.message ??
              "Roles could not be loaded.",
          );
        }

        setData(payload);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Roles could not be loaded.",
        );
      } finally {
        setLoading(false);
      }
    }, []);

  useEffect(() => {
    void loadRoles();
  }, [loadRoles]);

  const permissionGroups =
    useMemo(() => {
      const groups =
        new Map<
          string,
          Permission[]
        >();

      for (
        const permission
        of data?.permissions ?? []
      ) {
        const current =
          groups.get(
            permission.module,
          ) ?? [];

        current.push(permission);
        groups.set(
          permission.module,
          current,
        );
      }

      return Array.from(
        groups.entries(),
      );
    }, [data]);

  function togglePermission(
    permissionId: string,
    selected: string[],
    setSelected:
      (value: string[]) => void,
  ) {
    setSelected(
      selected.includes(
        permissionId,
      )
        ? selected.filter(
            (id) =>
              id !== permissionId,
          )
        : [
            ...selected,
            permissionId,
          ],
    );
  }

  async function createRole(
    event: FormEvent,
  ) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch(
        "/api/dashboard/administration/roles",
        {
          method: "POST",
          headers: {
            "content-type":
              "application/json",
          },
          body: JSON.stringify({
            name,
            description,
            permissionIds:
              createPermissionIds,
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
            "Role could not be created.",
        );
      }

      setName("");
      setDescription("");
      setCreatePermissionIds([]);
      setShowCreate(false);
      setNotice(
        "Custom role created.",
      );
      await loadRoles();
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "Role could not be created.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function updateRole(
    roleId: string,
    update: {
      permissionIds?: string[];
      isActive?: boolean;
    },
  ) {
    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch(
        `/api/dashboard/administration/roles/${roleId}`,
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
            "Role could not be updated.",
        );
      }

      setEditingRoleId(null);
      setEditingPermissionIds([]);
      setNotice(
        "Role permissions updated.",
      );
      await loadRoles();
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Role could not be updated.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading && !data) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 text-sm text-slate-400">
        Loading roles…
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-rose-200">
        {error ??
          "Roles are unavailable."}
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
              Roles & permissions
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
              Control platform access through explicit,
              auditable permissions. Users may hold more
              than one role.
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
              className="rounded-xl border border-blue-500/30 bg-blue-500/10 px-5 py-3 text-sm font-semibold text-blue-300"
            >
              {showCreate
                ? "Close form"
                : "Create role"}
            </button>
          ) : null}
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <Summary
            label="Roles"
            value={String(
              data.roles.length,
            )}
          />
          <Summary
            label="Permissions"
            value={String(
              data.permissions.length,
            )}
          />
          <Summary
            label="Custom roles"
            value={String(
              data.roles.filter(
                (role) =>
                  !role.isSystem,
              ).length,
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
          onSubmit={createRole}
          className="rounded-2xl border border-blue-500/20 bg-slate-900 p-6"
        >
          <h2 className="text-xl font-bold text-white">
            Create custom role
          </h2>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="text-sm text-slate-300">
              Role name
              <input
                required
                minLength={2}
                value={name}
                onChange={(event) =>
                  setName(
                    event.target.value,
                  )
                }
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-blue-500"
              />
            </label>
            <label className="text-sm text-slate-300">
              Description
              <input
                value={description}
                onChange={(event) =>
                  setDescription(
                    event.target.value,
                  )
                }
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-blue-500"
              />
            </label>
          </div>

          <PermissionMatrix
            groups={permissionGroups}
            selected={
              createPermissionIds
            }
            disabled={false}
            onToggle={(permissionId) =>
              togglePermission(
                permissionId,
                createPermissionIds,
                setCreatePermissionIds,
              )
            }
          />

          <button
            type="submit"
            disabled={saving}
            className="mt-5 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving
              ? "Creating…"
              : "Create role"}
          </button>
        </form>
      ) : null}

      <section className="space-y-4">
        {data.roles.map((role) => {
          const editing =
            editingRoleId === role.id;
          const protectedRole =
            role.key ===
            "SUPER_ADMIN";
          const canEdit =
            data.currentUser.canManage &&
            (
              !role.isSystem ||
              data.currentUser
                .isSuperAdmin
            ) &&
            !protectedRole;

          return (
            <article
              key={role.id}
              className="rounded-2xl border border-slate-800 bg-slate-900 p-5"
            >
              <div className="flex flex-col justify-between gap-5 xl:flex-row xl:items-start">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-lg font-semibold text-white">
                      {role.name}
                    </h2>
                    <span className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-xs text-slate-300">
                      {role.key}
                    </span>
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                        role.isActive
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                          : "border-slate-700 bg-slate-800 text-slate-400"
                      }`}
                    >
                      {role.isActive
                        ? "ACTIVE"
                        : "INACTIVE"}
                    </span>
                    {role.isSystem ? (
                      <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs text-blue-300">
                        SYSTEM
                      </span>
                    ) : null}
                  </div>

                  <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
                    {role.description ??
                      "No description"}
                  </p>

                  <p className="mt-3 text-xs text-slate-500">
                    {role._count.users} users ·{" "}
                    {
                      role.permissions
                        .length
                    }{" "}
                    permissions
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {role.permissions.map(
                      (grant) => (
                        <span
                          key={
                            grant.permission.id
                          }
                          className="rounded-lg border border-slate-800 bg-slate-950/40 px-2.5 py-1 text-xs text-slate-400"
                        >
                          {
                            grant.permission
                              .key
                          }
                        </span>
                      ),
                    )}
                  </div>
                </div>

                {data.currentUser.canManage ? (
                  <div className="flex flex-wrap gap-2">
                    {canEdit ? (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => {
                          setEditingRoleId(
                            editing
                              ? null
                              : role.id,
                          );
                          setEditingPermissionIds(
                            role.permissions.map(
                              (grant) =>
                                grant.permission.id,
                            ),
                          );
                        }}
                        className="rounded-lg border border-blue-500/30 px-3 py-2 text-xs font-semibold text-blue-300"
                      >
                        {editing
                          ? "Cancel"
                          : "Edit permissions"}
                      </button>
                    ) : null}

                    {!protectedRole ? (
                      <button
                        type="button"
                        disabled={
                          saving ||
                          (
                            role.isActive &&
                            role._count.users >
                              0
                          )
                        }
                        onClick={() =>
                          void updateRole(
                            role.id,
                            {
                              isActive:
                                !role.isActive,
                            },
                          )
                        }
                        className={`rounded-lg border px-3 py-2 text-xs font-semibold ${
                          role.isActive
                            ? "border-rose-500/30 text-rose-300"
                            : "border-emerald-500/30 text-emerald-300"
                        } disabled:opacity-40`}
                      >
                        {role.isActive
                          ? "Disable"
                          : "Enable"}
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>

              {editing ? (
                <div className="mt-5 border-t border-slate-800 pt-5">
                  <PermissionMatrix
                    groups={
                      permissionGroups
                    }
                    selected={
                      editingPermissionIds
                    }
                    disabled={false}
                    onToggle={(
                      permissionId,
                    ) =>
                      togglePermission(
                        permissionId,
                        editingPermissionIds,
                        setEditingPermissionIds,
                      )
                    }
                  />
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() =>
                      void updateRole(
                        role.id,
                        {
                          permissionIds:
                            editingPermissionIds,
                        },
                      )
                    }
                    className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    Save permissions
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

function PermissionMatrix({
  groups,
  selected,
  disabled,
  onToggle,
}: {
  groups: Array<
    [string, Permission[]]
  >;
  selected: string[];
  disabled: boolean;
  onToggle:
    (permissionId: string) => void;
}) {
  return (
    <div className="mt-5 grid gap-4 lg:grid-cols-2">
      {groups.map(
        ([module, permissions]) => (
          <div
            key={module}
            className="rounded-xl border border-slate-800 bg-slate-950/30 p-4"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-400">
              {module
                .split("_")
                .join(" ")}
            </p>
            <div className="mt-3 space-y-2">
              {permissions.map(
                (permission) => (
                  <label
                    key={permission.id}
                    className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-800 px-3 py-2"
                  >
                    <input
                      type="checkbox"
                      checked={selected.includes(
                        permission.id,
                      )}
                      disabled={disabled}
                      onChange={() =>
                        onToggle(
                          permission.id,
                        )
                      }
                      className="mt-1"
                    />
                    <div>
                      <p className="text-sm font-medium text-white">
                        {permission.name}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {permission.key}
                      </p>
                    </div>
                  </label>
                ),
              )}
            </div>
          </div>
        ),
      )}
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
