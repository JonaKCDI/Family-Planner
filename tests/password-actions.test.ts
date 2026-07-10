import { beforeEach, describe, expect, test, vi } from "vitest";

const { dbMock, authMock, redirectMock, revalidatePathMock } = vi.hoisted(() => ({
  dbMock: {
    $transaction: vi.fn(async (operations: Promise<unknown>[]) => Promise.all(operations)),
    user: {
      findUnique: vi.fn(),
      update: vi.fn()
    },
    session: {
      deleteMany: vi.fn()
    },
    loginAttempt: {
      deleteMany: vi.fn()
    },
    familyMember: {
      findFirst: vi.fn()
    },
    adminRecoveryKey: {
      upsert: vi.fn(),
      update: vi.fn()
    }
  },
  authMock: {
    requireSession: vi.fn(),
    createSession: vi.fn(),
    hashPassword: vi.fn(async (password: string) => `hashed:${password}`),
    verifyPassword: vi.fn()
  },
  redirectMock: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
  revalidatePathMock: vi.fn()
}));

vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/auth", () => ({
  cleanupExpiredSessions: vi.fn(),
  createSession: authMock.createSession,
  destroySession: vi.fn(),
  hashPassword: authMock.hashPassword,
  requireSession: authMock.requireSession,
  verifyPassword: authMock.verifyPassword
}));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));

describe("password actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.requireSession.mockResolvedValue({
      user: { id: "user_admin" },
      family: { id: "family_1" },
      role: "ADMIN"
    });
    authMock.verifyPassword.mockResolvedValue(true);
    dbMock.user.findUnique.mockResolvedValue({ id: "user_admin", name: "Jona", passwordHash: "old-hash" });
    dbMock.user.update.mockResolvedValue({ id: "updated" });
    dbMock.session.deleteMany.mockResolvedValue({ count: 1 });
    dbMock.loginAttempt.deleteMany.mockResolvedValue({ count: 1 });
    dbMock.adminRecoveryKey.upsert.mockResolvedValue({ id: "recovery_1" });
    dbMock.adminRecoveryKey.update.mockResolvedValue({ id: "recovery_1" });
    dbMock.familyMember.findFirst.mockResolvedValue({
      familyId: "family_1",
      userId: "user_member",
      role: "MEMBER",
      user: { name: "Mara" },
      family: { adminRecoveryKey: { keyHash: "hashed-recovery-key" } }
    });
  });

  test("changes the current user's password and starts a fresh session", async () => {
    const { changeOwnPassword } = await import("../src/lib/actions");
    const formData = passwordForm({
      currentPassword: "old-password",
      newPassword: "new-password-123",
      confirmPassword: "new-password-123"
    });

    await expect(changeOwnPassword(formData)).rejects.toThrow("REDIRECT:/einstellungen/konto?password=changed");

    expect(authMock.verifyPassword).toHaveBeenCalledWith("old-password", "old-hash");
    expect(dbMock.user.update).toHaveBeenCalledWith({
      where: { id: "user_admin" },
      data: { passwordHash: "hashed:new-password-123" }
    });
    expect(dbMock.session.deleteMany).toHaveBeenCalledWith({ where: { userId: "user_admin" } });
    expect(dbMock.loginAttempt.deleteMany).toHaveBeenCalledWith({ where: { normalizedName: "jona" } });
    expect(authMock.createSession).toHaveBeenCalledWith("user_admin");
  });

  test("rejects own password changes with the wrong current password", async () => {
    authMock.verifyPassword.mockResolvedValue(false);
    const { changeOwnPassword } = await import("../src/lib/actions");

    await expect(changeOwnPassword(passwordForm({
      currentPassword: "wrong",
      newPassword: "new-password-123",
      confirmPassword: "new-password-123"
    }))).rejects.toThrow("Das aktuelle Passwort stimmt nicht.");

    expect(dbMock.user.update).not.toHaveBeenCalled();
    expect(authMock.createSession).not.toHaveBeenCalled();
  });

  test("lets admins reset active family members, including other admins", async () => {
    dbMock.familyMember.findFirst.mockResolvedValue({
      familyId: "family_1",
      userId: "other_admin",
      role: "ADMIN",
      user: { name: "Ada" }
    });
    const { resetMemberPassword } = await import("../src/lib/actions");

    await resetMemberPassword(passwordForm({
      userId: "other_admin",
      newPassword: "admin-password-123",
      confirmPassword: "admin-password-123"
    }));

    expect(dbMock.familyMember.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { familyId: "family_1", userId: "other_admin", status: "ACTIVE" }
    }));
    expect(dbMock.user.update).toHaveBeenCalledWith({
      where: { id: "other_admin" },
      data: { passwordHash: "hashed:admin-password-123" }
    });
    expect(dbMock.session.deleteMany).toHaveBeenCalledWith({ where: { userId: "other_admin" } });
    expect(dbMock.loginAttempt.deleteMany).toHaveBeenCalledWith({ where: { normalizedName: "ada" } });
  });

  test("does not let admins reset their own password through the admin reset form", async () => {
    const { resetMemberPassword } = await import("../src/lib/actions");

    await expect(resetMemberPassword(passwordForm({
      userId: "user_admin",
      newPassword: "admin-password-123",
      confirmPassword: "admin-password-123"
    }))).rejects.toThrow("Ändere dein eigenes Passwort bitte mit deinem aktuellen Passwort.");

    expect(dbMock.user.update).not.toHaveBeenCalled();
  });

  test("stores a family recovery key from settings", async () => {
    const { setAdminRecoveryKey } = await import("../src/lib/actions");

    await expect(setAdminRecoveryKey(passwordForm({
      recoveryKey: "family-recovery-key-12345",
      confirmRecoveryKey: "family-recovery-key-12345"
    }))).rejects.toThrow("REDIRECT:/einstellungen/wiederherstellung?recovery=changed");

    expect(dbMock.adminRecoveryKey.upsert).toHaveBeenCalledWith({
      where: { familyId: "family_1" },
      create: {
        familyId: "family_1",
        keyHash: "hashed:family-recovery-key-12345",
        createdByUserId: "user_admin"
      },
      update: {
        keyHash: "hashed:family-recovery-key-12345",
        createdByUserId: "user_admin",
        lastUsedAt: null
      }
    });
  });

  test("recovers an admin password with the stored family recovery key", async () => {
    const { recoverAdminPassword } = await import("../src/lib/actions");

    await expect(recoverAdminPassword(passwordForm({
      name: "Jona",
      recoveryKey: "family-recovery-key-12345",
      newPassword: "recovered-password-123",
      confirmPassword: "recovered-password-123"
    }))).rejects.toThrow("REDIRECT:/dashboard");

    expect(dbMock.familyMember.findFirst).toHaveBeenCalledWith({
      where: {
        user: { name: "Jona", status: "ACTIVE" },
        role: "ADMIN",
        status: "ACTIVE"
      },
      include: { user: true, family: { include: { adminRecoveryKey: true } } }
    });
    expect(authMock.verifyPassword).toHaveBeenCalledWith("family-recovery-key-12345", "hashed-recovery-key");
    expect(dbMock.user.update).toHaveBeenCalledWith({
      where: { id: "user_member" },
      data: { passwordHash: "hashed:recovered-password-123" }
    });
    expect(dbMock.adminRecoveryKey.update).toHaveBeenCalledWith({
      where: { familyId: "family_1" },
      data: { lastUsedAt: expect.any(Date) }
    });
    expect(authMock.createSession).toHaveBeenCalledWith("user_member");
  });

  test("rejects emergency recovery when no stored key exists", async () => {
    dbMock.familyMember.findFirst.mockResolvedValue({
      familyId: "family_1",
      userId: "user_admin",
      role: "ADMIN",
      user: { name: "Jona" },
      family: { adminRecoveryKey: null }
    });
    const { recoverAdminPassword } = await import("../src/lib/actions");

    await expect(recoverAdminPassword(passwordForm({
      name: "Jona",
      recoveryKey: "family-recovery-key-12345",
      newPassword: "recovered-password-123",
      confirmPassword: "recovered-password-123"
    }))).rejects.toThrow("Name oder Notfallschlüssel stimmt nicht.");

    expect(dbMock.user.update).not.toHaveBeenCalled();
    expect(authMock.createSession).not.toHaveBeenCalled();
  });
});

function passwordForm(values: Record<string, string>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(values)) {
    formData.set(key, value);
  }
  return formData;
}
