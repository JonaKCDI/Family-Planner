import { beforeEach, expect, test, vi } from "vitest";

const mocks=vi.hoisted(()=>({contracts:vi.fn(),series:vi.fn(),existing:vi.fn(),create:vi.fn()}));
vi.mock("@/lib/db",()=>({db:{contract:{findMany:mocks.contracts},recurringTransaction:{findMany:mocks.series},expense:{findMany:mocks.existing,createMany:mocks.create}}}));
import { ensureDueContractExpenses } from "../src/lib/contract-auto-expenses";

const phase={amountCents:1000,currency:"EUR",billingInterval:"MONTHLY",validFrom:new Date("2026-09-01")};
const series={id:"series",familyId:"family",ownerUserId:"a",kind:"EXPENSE",title:"Shared",description:"",store:"",paymentMethod:"Karte",startDate:new Date("2026-09-01"),endDate:null,status:"ACTIVE",deletedAt:null,pricePhases:[phase],sharedWithFamily:true};
beforeEach(()=>{vi.resetAllMocks();mocks.contracts.mockResolvedValue([]);mocks.series.mockResolvedValue([]);mocks.existing.mockResolvedValue([]);mocks.create.mockResolvedValue({count:1});});
test("new recurring expenses inherit explicit sharing and deterministic deduplication IDs",async()=>{
  mocks.series.mockResolvedValue([series]);
  await ensureDueContractExpenses("family","a",new Date("2026-09-10"),{force:true});
  const first=mocks.create.mock.calls[0][0];
  expect(first.data[0]).toMatchObject({sharedWithFamily:true,ownerUserId:"a",kind:"EXPENSE"});
  expect(first.skipDuplicates).toBe(true);
  await ensureDueContractExpenses("family","a",new Date("2026-09-10"),{force:true});
  expect(mocks.create.mock.calls[1][0].data[0].id).toBe(first.data[0].id);
});
test("existing dates are skipped and their sharing is never overwritten",async()=>{
  mocks.series.mockResolvedValue([{...series,sharedWithFamily:false}]);
  mocks.existing.mockResolvedValue([{date:new Date("2026-09-01")}]);
  await ensureDueContractExpenses("family","a",new Date("2026-09-10"),{force:true});
  expect(mocks.create).not.toHaveBeenCalled();
});
test("income recurrence never produces shared income",async()=>{
  mocks.series.mockResolvedValue([{...series,kind:"INCOME"}]);
  await ensureDueContractExpenses("family","a",new Date("2026-09-10"),{force:true});
  expect(mocks.create.mock.calls[0][0].data[0].sharedWithFamily).toBe(false);
});
test("new contract expenses inherit their separate sharing default",async()=>{
  mocks.contracts.mockResolvedValue([{id:"contract",provider:"Provider",contractType:"Type",startDate:new Date("2026-09-01"),endDate:null,status:"ACTIVE",autoRenewal:true,autoCreateExpenses:true,billingInterval:"MONTHLY",costCents:1000,expensePaymentDay:1,pricePhases:[phase],expenseSharedWithFamily:true}]);
  await ensureDueContractExpenses("family","a",new Date("2026-09-10"),{force:true});
  expect(mocks.create.mock.calls[0][0].data[0]).toMatchObject({sharedWithFamily:true,generatedByContract:true,ownerUserId:"a"});
});
