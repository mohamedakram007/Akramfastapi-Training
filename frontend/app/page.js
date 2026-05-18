"use client";

import { useState } from "react";
import {
  FiEdit2,
  FiLogIn,
  FiLock,
  FiShield,
  FiTrash2,
  FiUserPlus,
  FiUsers,
} from "react-icons/fi";

const PRODUCTION_API = "https://crudoperations-eh5h.onrender.com";
const ADMIN_EMAIL = "akram@gmail.com";
const ADMIN_PASSWORD = "akram123";

const emptyForm = {
  name: "",
  email: "",
  age: "",
};

const getApiBase = () => {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }

  if (
    typeof window !== "undefined" &&
    ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname)
  ) {
    return `${window.location.protocol}//${window.location.hostname}:8000`;
  }

  return PRODUCTION_API;
};

const apiRequest = async (path, options) => {
  let res;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    res = await fetch(`${getApiBase()}${path}`, {
      ...options,
      signal: controller.signal,
    });
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("The backend or database is taking too long to respond. Check the FastAPI terminal and MongoDB connection.");
    }

    throw new Error("Cannot connect to the FastAPI backend. Start the backend on http://localhost:8000.");
  } finally {
    clearTimeout(timeoutId);
  }

  let data = null;

  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    throw new Error(data?.detail || data?.error || "The backend returned an error.");
  }

  return data;
};

const fetchUsers = async () => apiRequest("/users");

const fetchStats = async () => apiRequest("/dashboard/stats");

export default function Home() {
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState({
    signups: 0,
    logins: 0,
    authenticationRequired: false,
  });
  const [form, setForm] = useState(emptyForm);
  const [adminForm, setAdminForm] = useState({
    email: "",
    password: "",
  });
  const [editingId, setEditingId] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formMessage, setFormMessage] = useState("");
  const [adminMessage, setAdminMessage] = useState("");
  const [apiMessage, setApiMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const loadDashboard = async () => {
    try {
      setApiMessage("");
      const [usersData, statsData] = await Promise.all([
        fetchUsers(),
        fetchStats(),
      ]);
      setUsers(usersData);
      setStats(statsData);
    } catch (error) {
      setApiMessage(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const resetSignupForm = () => {
    setEditingId(null);
    setForm(emptyForm);
  };

  const saveUser = async () => {
    setFormMessage("");
    setIsSaving(true);

    const endpoint = editingId ? `/users/${editingId}` : "/users";
    const method = editingId ? "PUT" : "POST";

    try {
      await apiRequest(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...form,
          age: Number(form.age),
        }),
      });
      resetSignupForm();
      await loadDashboard();
      setFormMessage(editingId ? "Signup updated successfully." : "Signup added successfully.");
    } catch (error) {
      setFormMessage(error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const deleteUser = async (id) => {
    try {
      await apiRequest(`/users/${id}`, {
        method: "DELETE",
      });
      await loadDashboard();
    } catch (error) {
      setApiMessage(error.message);
    }
  };

  const editUser = (user) => {
    setFormMessage("");
    setForm({
      name: user.name,
      email: user.email,
      age: user.age,
    });
    setEditingId(user.id);
  };

  const signInAdmin = async () => {
    setAdminMessage("");

    if (
      adminForm.email.trim().toLowerCase() !== ADMIN_EMAIL ||
      adminForm.password !== ADMIN_PASSWORD
    ) {
      setAdminMessage("Invalid admin email or password.");
      return;
    }

    try {
      const data = await apiRequest("/login", {
        method: "POST",
      });

      setStats((currentStats) => ({
        ...currentStats,
        logins: data.logins,
        authenticationRequired: data.authenticationRequired,
      }));
      setIsAdmin(true);
      setAdminForm({
        email: "",
        password: "",
      });
      await loadDashboard();
    } catch (error) {
      setAdminMessage(error.message);
    }
  };

  const signOutAdmin = () => {
    setIsAdmin(false);
    resetSignupForm();
  };

  const isSignupFormComplete =
    form.name.trim() && form.email.trim() && String(form.age).trim();
  const isAdminFormComplete =
    adminForm.email.trim() && adminForm.password.trim();

  return (
    <main className="min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_top_left,#134e4a_0,#111827_38%,#030712_100%)] px-4 py-6 text-white sm:px-8 lg:px-12">
      <section className="mx-auto grid min-h-[calc(100vh-48px)] max-w-7xl overflow-hidden rounded-lg border border-white/15 bg-white/10 shadow-2xl shadow-black/40 backdrop-blur-xl lg:grid-cols-[380px_1fr]">
        <aside className="border-b border-white/10 bg-black/20 p-5 lg:border-b-0 lg:border-r">
          <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-emerald-300">
            Protected dashboard
          </p>
          <h1 className="mb-7 text-3xl font-bold sm:text-4xl">User Activity</h1>

          <form
            className="mb-5 flex flex-col gap-3 rounded-lg border border-emerald-300/30 bg-neutral-950/55 p-4 shadow-lg shadow-emerald-950/20"
            onSubmit={(event) => {
              event.preventDefault();
              saveUser();
            }}
          >
            <h2 className="text-xl font-bold">
              {editingId ? "Edit Signup" : "Add Signup"}
            </h2>
            <p className="text-sm leading-6 text-neutral-300">
              Public visitors can submit this form. Admin-only dashboard details stay hidden until sign-in.
            </p>

            {formMessage && (
              <p className="rounded-md border border-emerald-300/40 bg-emerald-300/10 p-3 text-sm font-medium text-emerald-100">
                {formMessage}
              </p>
            )}

            <input
              className="rounded-md border border-white/10 bg-white/10 p-3 outline-none transition focus:border-emerald-300"
              disabled={isSaving || isLoading}
              placeholder="Name"
              value={form.name}
              onChange={(event) =>
                setForm({
                  ...form,
                  name: event.target.value,
                })
              }
              required
            />
            <input
              className="rounded-md border border-white/10 bg-white/10 p-3 outline-none transition focus:border-emerald-300"
              disabled={isSaving || isLoading}
              placeholder="Email"
              type="email"
              value={form.email}
              onChange={(event) =>
                setForm({
                  ...form,
                  email: event.target.value,
                })
              }
              required
            />
            <input
              className="rounded-md border border-white/10 bg-white/10 p-3 outline-none transition focus:border-emerald-300"
              disabled={isSaving || isLoading}
              min="1"
              placeholder="Age"
              type="number"
              value={form.age}
              onChange={(event) =>
                setForm({
                  ...form,
                  age: event.target.value,
                })
              }
              required
            />

            <button
              className="inline-flex items-center justify-center gap-2 rounded-md bg-white p-3 font-bold text-neutral-950 transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-70"
              disabled={isSaving || isLoading || !isSignupFormComplete}
              type="submit"
            >
              {isSaving ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-400 border-t-neutral-950" />
              ) : (
                <FiUsers aria-hidden="true" />
              )}
              {isSaving
                ? editingId
                  ? "Updating..."
                  : "Adding..."
                : editingId
                  ? "Update User"
                  : "Add User"}
            </button>

            {editingId && (
              <button
                className="rounded-md border border-white/15 px-4 py-3 font-semibold text-neutral-200 transition hover:bg-white/10"
                disabled={isSaving}
                onClick={resetSignupForm}
                type="button"
              >
                Cancel Edit
              </button>
            )}
          </form>

          {!isAdmin && (
            <div className="rounded-lg border border-dashed border-white/15 bg-black/20 p-5">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-md bg-white/10 text-emerald-200">
                <FiLock aria-hidden="true" />
              </div>
              <h2 className="mb-3 text-xl font-bold">Admin analytics are hidden</h2>
              <p className="text-sm leading-6 text-neutral-300">
                Public visitors can sign up here, but user lists, login counts, edit controls, and dashboard details stay locked until the admin signs in.
              </p>
            </div>
          )}
        </aside>

        <section className="flex min-h-[620px] flex-col p-5 lg:min-h-0">
          {apiMessage && (
            <p className="mb-4 rounded-md border border-amber-300/40 bg-amber-300/10 p-3 text-sm font-medium text-amber-100">
              {apiMessage}
            </p>
          )}

          {isLoading && (
            <div className="m-auto max-w-md text-center">
              <p className="text-lg font-bold">Loading dashboard...</p>
              <p className="mt-2 text-sm text-neutral-300">
                Buttons and form controls are locked until this finishes.
              </p>
            </div>
          )}

          {!isLoading && !isAdmin && (
            <form
              className="m-auto w-full max-w-md rounded-lg border border-white/10 bg-white/10 p-6 shadow-2xl shadow-black/30"
              onSubmit={(event) => {
                event.preventDefault();
                signInAdmin();
              }}
            >
              <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-300/15 text-emerald-200">
                <FiShield aria-hidden="true" />
              </div>
              <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300">
                Admin Access
              </p>
              <h2 className="mb-4 text-3xl font-bold">Unlock dashboard details</h2>
              <p className="mb-6 text-sm leading-6 text-neutral-300">
                Sign in as the admin to view user records, login counts, and protected dashboard analytics.
              </p>

              {adminMessage && (
                <p className="mb-4 rounded-md border border-rose-300/40 bg-rose-300/10 p-3 text-sm font-medium text-rose-100">
                  {adminMessage}
                </p>
              )}

              <div className="grid gap-3">
                <input
                  className="rounded-md border border-white/10 bg-white/10 p-3 outline-none transition focus:border-emerald-300"
                  placeholder="Admin email"
                  type="email"
                  value={adminForm.email}
                  onChange={(event) =>
                    setAdminForm({
                      ...adminForm,
                      email: event.target.value,
                    })
                  }
                  required
                />
                <input
                  className="rounded-md border border-white/10 bg-white/10 p-3 outline-none transition focus:border-emerald-300"
                  placeholder="Admin password"
                  type="password"
                  value={adminForm.password}
                  onChange={(event) =>
                    setAdminForm({
                      ...adminForm,
                      password: event.target.value,
                    })
                  }
                  required
                />
                <button
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-emerald-300 p-3 font-bold text-neutral-950 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={!isAdminFormComplete}
                  type="submit"
                >
                  <FiLogIn aria-hidden="true" />
                  Sign in as admin
                </button>
              </div>
            </form>
          )}

          {!isLoading && isAdmin && (
            <>
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
                    Admin Dashboard
                  </p>
                  <h2 className="text-2xl font-bold">All Users</h2>
                </div>
                <button
                  className="inline-flex w-fit items-center justify-center gap-2 rounded-md border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-neutral-100 transition hover:bg-white/15"
                  onClick={signOutAdmin}
                  type="button"
                >
                  <FiLock aria-hidden="true" />
                  Sign Out
                </button>
              </div>

              <div className="mb-5 grid gap-3 md:grid-cols-3">
                <div className="rounded-lg border border-white/10 bg-white/10 p-4">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-cyan-300 text-neutral-950">
                    <FiUserPlus aria-hidden="true" />
                  </div>
                  <p className="text-sm text-neutral-300">Signup Details</p>
                  <p className="text-3xl font-bold">{stats.signups}</p>
                  <p className="text-xs text-neutral-400">registered users</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/10 p-4">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-amber-200 text-neutral-950">
                    <FiLogIn aria-hidden="true" />
                  </div>
                  <p className="text-sm text-neutral-300">Admin Sign-ins</p>
                  <p className="text-3xl font-bold">{stats.logins}</p>
                  <p className="text-xs text-neutral-400">admin sign-ins</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/10 p-4">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-rose-200 text-neutral-950">
                    <FiShield aria-hidden="true" />
                  </div>
                  <p className="text-sm text-neutral-300">Authentication</p>
                  <p className="text-xl font-bold">Admin Unlocked</p>
                  <p className="text-xs text-neutral-400">protected view</p>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-white/10 bg-black/20 p-3 [scrollbar-color:#67e8f9_transparent] [scrollbar-width:thin]">
                <div className="grid gap-3">
                  {users.map((user) => (
                    <div
                      key={user.id}
                      className="group grid gap-4 rounded-lg border border-white/10 bg-white/10 p-4 transition duration-200 hover:-translate-y-0.5 hover:border-emerald-300/50 hover:bg-white/15 sm:grid-cols-[1.2fr_1.5fr_80px_auto] sm:items-center"
                    >
                      <div>
                        <p className="text-xs uppercase tracking-wide text-neutral-400">Name</p>
                        <h3 className="truncate text-xl font-bold transition group-hover:text-emerald-200">
                          {user.name || "No name"}
                        </h3>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs uppercase tracking-wide text-neutral-400">Email</p>
                        <p className="truncate text-neutral-200">{user.email || "No email"}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-neutral-400">Age</p>
                        <p className="text-lg font-semibold text-neutral-100">{user.age}</p>
                      </div>
                      <div className="flex gap-2 sm:justify-end">
                        <button
                          className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-cyan-300 text-neutral-950 transition hover:bg-cyan-200"
                          onClick={() => editUser(user)}
                          title="Edit user"
                          type="button"
                        >
                          <FiEdit2 aria-hidden="true" />
                        </button>
                        <button
                          className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-rose-400 text-white transition hover:bg-rose-300"
                          onClick={() => deleteUser(user.id)}
                          title="Delete user"
                          type="button"
                        >
                          <FiTrash2 aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  ))}

                  {users.length === 0 && (
                    <div className="rounded-lg border border-dashed border-white/20 p-8 text-center text-neutral-300">
                      No users yet.
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </section>
      </section>
    </main>
  );
}
