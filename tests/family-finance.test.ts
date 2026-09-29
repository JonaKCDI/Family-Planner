import { describe, expect, test } from "vitest";
import { filterFamilyExpenses, familyPersonPositions, familyPersonTotals } from "../src/lib/family-finance-filters";
import { buildFamilyFinanceWorkbook } from "../src/lib/family-finance-workbook";
import { buildExpenseWorkbook, parseExpenseWorkbook } from "../src/lib/expense-formats";
import { buildExpensesHref } from "../src/lib/expense-filter-url";

const row = {id:"one",kind:"EXPENSE" as const,date:new Date("2026-09-01T00:00:00Z"),currency:"EUR",amountCents:1000,description:"Einkauf",store:"Markt",paymentMethod:"Karte",person:{id:"a",name:"Anna"},categoryId:"food",labelId:null,category:{id:"food",name:"Lebensmittel",color:"#16776f",icon:"tag",monthlyBudgetCents:10000,excludeFromForecast:false,familyId:"family",archivedAt:null},label:null,canEdit:true};
const rows=[row,{...row,id:"two",amountCents:3000,person:{id:"b",name:"Ben"}},{...row,id:"usd",currency:"USD",amountCents:99999}];

describe("family finance calculations",()=>{
  test("keeps actual spending while transfers change only net contribution", () => {
    const entries = [
      { date: new Date("2026-09-01"), currency: "EUR", amountCents: 10000, description: "", store: "", paymentMethod: "", person: { id: "a", name: "Anna" }, categoryId: null, labelId: null, category: null, label: null },
      { date: new Date("2026-09-02"), currency: "EUR", amountCents: 2000, description: "", store: "", paymentMethod: "", person: { id: "b", name: "Ben" }, categoryId: null, labelId: null, category: null, label: null }
    ];
    const positions = familyPersonPositions(entries, [{ senderUserId: "b", recipientUserId: "a", amountCents: 4000, currency: "EUR", date: new Date("2026-09-03") }]);
    expect(positions.find(item => item.id === "a")).toMatchObject({ spending: 10000, net: 6000 });
    expect(positions.find(item => item.id === "b")).toMatchObject({ spending: 2000, net: 6000 });
  });
  test("currencies never mix and proportions use the selected entries",()=>{
    const selected=filterFamilyExpenses(rows,{month:"2026-09"});
    expect(selected).toHaveLength(2);
    expect(familyPersonTotals(selected).map(p=>p.percent)).toEqual([75,25]);
    expect(familyPersonTotals(filterFamilyExpenses(rows,{month:"2026-09",person:"a"}))[0].percent).toBe(100);
    expect(familyPersonTotals([{...row,amountCents:0}])[0].percent).toBeNull();
  });
  test("search, missing mappings and custom dates",()=>{
    expect(filterFamilyExpenses(rows,{month:"2026-09",q:"lebensmittel"})).toHaveLength(2);
    expect(filterFamilyExpenses(rows,{month:"2026-09",q:"Anna"})).toHaveLength(1);
    expect(filterFamilyExpenses([{...row,categoryId:null,category:null}],{month:"2026-09",category:"unassigned"})).toHaveLength(1);
    expect(filterFamilyExpenses(rows,{month:"2026-08",from:"2026-09-01",to:"2026-09-30"})).toHaveLength(2);
  });
  test("family context and people view survive URL normalization",()=>{
    expect(buildExpensesHref({bereich:"familie",person:"a",view:"people",month:"2026-09"})).toContain("view=people");
    expect(buildExpensesHref({bereich:"familie",person:"a"})).toContain("bereich=familie");
  });
});

describe("finance backup compatibility",()=>{
  test("personal workbooks preserve explicit sharing and mapping names",async()=>{
    const file=await buildExpenseWorkbook([{...row,sharedWithFamily:true,categoryName:"Supermarkt",labelName:"",familyCategoryName:"Lebensmittel",familyLabelName:"Reise"}],2026);
    const parsed=await parseExpenseWorkbook(file as unknown as ArrayBuffer);
    expect(parsed[0]).toMatchObject({sharedWithFamily:true,familyCategoryName:"Lebensmittel",familyLabelName:"Reise",categoryName:"Supermarkt"});
  });
  test("missing sharing remains unspecified for legacy updates",async()=>{
    const file=await buildExpenseWorkbook([{...row,categoryName:"Supermarkt",labelName:""}],2026);
    expect((await parseExpenseWorkbook(file as unknown as ArrayBuffer))[0].sharedWithFamily).toBeUndefined();
  });
  test("family report cannot be imported as a personal backup",async()=>{
    const file=await buildFamilyFinanceWorkbook([row]);
    await expect(parseExpenseWorkbook(file as unknown as ArrayBuffer)).rejects.toThrow("Familienauswertungen");
  });
});
