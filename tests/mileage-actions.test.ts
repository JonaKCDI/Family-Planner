import { beforeEach, describe, expect, test, vi } from "vitest";

const { dbMock, sessionMock, redirectMock } = vi.hoisted(() => ({
  dbMock: {
    car: {
      create: vi.fn(),
      findFirst: vi.fn(),
      updateMany: vi.fn()
    },
    fuelEntry: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn()
    }
  },
  sessionMock: {
    family: { id: "family_1" },
    user: { id: "user_1", name: "Jona" },
    role: "MEMBER" as "ADMIN" | "MEMBER"
  },
  redirectMock: vi.fn((url: string) => {
    throw new Error(`REDIRECT ${url}`);
  })
}));

vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/auth", () => ({ requireSession: vi.fn(async () => sessionMock) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));

describe("mileage action access", () => {
  let actions: typeof import("../src/lib/actions");

  beforeEach(async () => {
    vi.clearAllMocks();
    sessionMock.role = "MEMBER";
    dbMock.car.findFirst.mockResolvedValue({ id: "car_1", familyId: "family_1", name: "Seat Leon", archivedAt: null });
    dbMock.car.create.mockImplementation(async ({ data }) => ({ id: "car_new", ...data }));
    dbMock.fuelEntry.upsert.mockResolvedValue({ id: "fuel_1" });
    actions = await import("../src/lib/actions");
  });

  test("blocks non-admin car management", async () => {
    const form = new FormData();
    form.set("name", "Seat Leon");

    await expect(actions.createCar(form)).rejects.toThrow("Nur Admins");
    expect(dbMock.car.create).not.toHaveBeenCalled();
  });

  test("allows members to create shared fuel entries for a family car", async () => {
    const form = fuelEntryForm();

    await expect(actions.createFuelEntry(form)).rejects.toThrow("REDIRECT /kilometer?car=car_1");
    expect(dbMock.car.findFirst).toHaveBeenCalledWith({
      where: { id: "car_1", familyId: "family_1", archivedAt: null }
    });
    expect(dbMock.fuelEntry.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        familyId: "family_1",
        carId: "car_1",
        createdByUserId: "user_1",
        odometerKm: 48618,
        litersMilli: 45260,
        costCents: 7101,
        note: "Test"
      })
    }));
  });

  test("rejects fuel entries for cars outside the current family", async () => {
    dbMock.car.findFirst.mockResolvedValue(null);

    await expect(actions.createFuelEntry(fuelEntryForm())).rejects.toThrow("Auto");
    expect(dbMock.fuelEntry.upsert).not.toHaveBeenCalled();
  });
});

function fuelEntryForm() {
  const form = new FormData();
  form.set("carId", "car_1");
  form.set("date", "2025-12-22");
  form.set("odometerKm", "48618");
  form.set("liters", "45,26");
  form.set("cost", "71,01");
  form.set("note", "Test");
  return form;
}
