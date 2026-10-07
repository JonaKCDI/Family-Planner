import { beforeEach, expect, test, vi } from "vitest";

const mocks=vi.hoisted(()=>({member:vi.fn(),members:vi.fn(),expenses:vi.fn(),categories:vi.fn(),labels:vi.fn(),categoryMaps:vi.fn(),labelMaps:vi.fn(),sources:vi.fn(),generate:vi.fn()}));
vi.mock("@/lib/auth",()=>({requireSession:async()=>({family:{id:"family"},user:{id:"a"},role:"MEMBER"})}));
vi.mock("@/lib/contract-auto-expenses",()=>({ensureDueContractExpenses:mocks.generate}));
vi.mock("@/lib/db",()=>({db:{familyMember:{findFirst:mocks.member,findMany:mocks.members},expense:{findMany:mocks.expenses},familyFinanceCategory:{findMany:mocks.categories},familyFinanceLabel:{findMany:mocks.labels},familyCategoryMapping:{findMany:mocks.categoryMaps},familyLabelMapping:{findMany:mocks.labelMaps},contract:{findMany:mocks.sources},recurringTransaction:{findMany:mocks.sources}}}));
import {getFamilyFinance} from "../src/lib/family-finance";

beforeEach(()=>{
  vi.resetAllMocks();mocks.member.mockResolvedValue({role:"MEMBER"});
  for(const mock of [mocks.members,mocks.expenses,mocks.categories,mocks.labels,mocks.categoryMaps,mocks.labelMaps,mocks.sources])mock.mockResolvedValue([]);
});
test("requires active membership before any finance read",async()=>{
  mocks.member.mockResolvedValue(null);
  await expect(getFamilyFinance()).rejects.toThrow("nicht verfügbar");
  expect(mocks.expenses).not.toHaveBeenCalled();
  expect(mocks.member).toHaveBeenCalledWith({where:{familyId:"family",userId:"a",status:"ACTIVE"}});
});
test("queries only explicit shared expenses within the current family",async()=>{
  await getFamilyFinance();
  const query=mocks.expenses.mock.calls[0][0];
  expect(query.where).toEqual({familyId:"family",sharedWithFamily:true,kind:"EXPENSE"});
  expect(query.select).not.toHaveProperty("contract");expect(query.select).not.toHaveProperty("fuelEntry");expect(query.select).not.toHaveProperty("recurringTransaction");
});
test("maps per owner and strips all private source fields",async()=>{
  mocks.categories.mockResolvedValue([{id:"shared",name:"Lebensmittel"}]);
  mocks.categoryMaps.mockResolvedValue([{personalId:"private",userId:"b",targetId:"shared"}]);
  mocks.expenses.mockResolvedValue([{id:"e",date:new Date(),amountCents:100,currency:"EUR",description:"Einkauf",store:"",paymentMethod:"",ownerUserId:"b",owner:{id:"b",name:"Ben"},categoryId:"private",labelId:null,contract:{provider:"SECRET"},scope:"FAMILY"}]);
  const {expenses}=await getFamilyFinance();
  expect(expenses[0]).toMatchObject({categoryId:"shared",canEdit:false,person:{name:"Ben"}});
  expect(JSON.stringify(expenses)).not.toContain("private");expect(JSON.stringify(expenses)).not.toContain("SECRET");
});
test("unmapped expense never falls back to a private category",async()=>{
  mocks.expenses.mockResolvedValue([{id:"e",date:new Date(),ownerUserId:"a",owner:{id:"a",name:"Anna"},categoryId:"private",labelId:"privateLabel"}]);
  const {expenses}=await getFamilyFinance();
  expect(expenses[0]).toMatchObject({category:null,categoryId:null,label:null,labelId:null,canEdit:true});
});
