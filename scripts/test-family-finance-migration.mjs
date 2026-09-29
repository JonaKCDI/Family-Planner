// Isolated PostgreSQL integration check; never uses the application database as a target.
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";

process.loadEnvFile();
const source = new URL(process.env.DATABASE_URL);
const testName = process.env.FAMILY_FINANCE_TEST_DATABASE || "family_finance_test_20260911";
if (!/^family_finance_test_[0-9]+$/.test(testName)) throw new Error("Invalid isolated test database name.");
if (source.pathname === `/${testName}`) throw new Error("Expected original connection for creating isolated test database.");
const psql = process.env.PSQL_BINARY || (process.platform === "win32" ? "C:/Program Files/PostgreSQL/17/bin/psql.exe" : "psql");
const env = {...process.env, PGPASSWORD:decodeURIComponent(source.password)};
function sql(database, input) {
  const result = spawnSync(psql,["-X","-v","ON_ERROR_STOP=1","-h",source.hostname,"-p",source.port||"5432","-U",decodeURIComponent(source.username),"-d",database],{input,encoding:"utf8",env,windowsHide:true});
  if(result.status!==0)throw new Error(result.stderr || String(result.error));
}
sql(source.pathname.slice(1),`CREATE DATABASE "${testName}";`);
const dirs = readdirSync("prisma/migrations").filter(name=>existsSync(resolve("prisma/migrations",name,"migration.sql"))).sort();
try {
  for(const name of dirs.filter(name=>name!=="20260911120000_family_finance")) sql(testName,readFileSync(resolve("prisma/migrations",name,"migration.sql"),"utf8"));
  sql(testName,`
    INSERT INTO "User" (id,name,"passwordHash","updatedAt") VALUES ('a','Anna','unused',now()),('b','Ben','unused',now()),('outsider','Other','unused',now());
    INSERT INTO "Family" (id,name,"updatedAt") VALUES ('family','Testfamilie',now()),('other','Andere Familie',now());
    INSERT INTO "FamilyMember" (id,"familyId","userId",role) VALUES ('ma','family','a','ADMIN'),('mb','family','b','MEMBER'),('mo','other','outsider','ADMIN');
    INSERT INTO "Category" (id,"familyId","ownerUserId",type,name,scope,"monthlyBudgetCents","excludeFromForecast") VALUES ('legacy','family','a','EXPENSE','Supermarkt','FAMILY',10000,true),('task','family','a','TASK','Aufgaben','FAMILY',0,false);
    INSERT INTO "Expense" (id,"familyId","ownerUserId",kind,"amountCents",date,description,scope,"categoryId","updatedAt") VALUES ('ea','family','a','EXPENSE',1000,'2026-09-01','Einkauf Anna','FAMILY','legacy',now()),('eb','family','b','EXPENSE',3000,'2026-09-02','Einkauf Ben','FAMILY','legacy',now()),('income','family','a','INCOME',9000,'2026-09-01','Privates Gehalt','FAMILY','legacy',now());
    INSERT INTO "ExpensePlanningRule" (id,"familyId","ownerUserId","patternType","patternValue","categoryId",treatment,"updatedAt") VALUES ('rule','family','b','CATEGORY_STORE','legacy:markt','legacy','FIXED_COST',now());
    INSERT INTO "ExpensePlanningTreatment" (id,"familyId","ownerUserId","groupKey",treatment,"updatedAt") VALUES ('treatment','family','b','category:legacy:2026-09','SPECIAL_EFFECT',now());
    INSERT INTO "FuelExpenseSettings" (id,"familyId","userId","defaultCategoryId","updatedAt") VALUES ('fuel-settings','family','b','legacy',now());
    INSERT INTO "RecurringTransaction" (id,"familyId","ownerUserId",title,"categoryId","startDate","updatedAt") VALUES ('series','family','b','Private Series','legacy','2027-01-01',now());
  `);
  sql(testName,readFileSync("prisma/migrations/20260911120000_family_finance/migration.sql","utf8"));
  const testUrl=new URL(source);testUrl.pathname=`/${testName}`;
  const db=new PrismaClient({datasourceUrl:testUrl.toString()});
  try {
    const expenses=await db.expense.findMany({include:{category:true}});
    if(expenses.length!==3||expenses.some(e=>e.sharedWithFamily))throw new Error("Legacy data was changed or published.");
    if(expenses.some(e=>e.category.ownerUserId!==e.ownerUserId||e.category.monthlyBudgetCents!==10000||!e.category.excludeFromForecast))throw new Error("Category split lost ownership or settings.");
    if((await db.category.findUnique({where:{id:"task"}})).scope!=="FAMILY")throw new Error("Task category changed.");
    const rule=await db.expensePlanningRule.findUnique({where:{id:"rule"}});
    const categoryB=expenses.find(e=>e.id==="eb").categoryId;
    if(rule.categoryId!==categoryB || rule.patternValue!==`${categoryB}:markt`)throw new Error("Planning rule key was not migrated.");
    if((await db.expensePlanningTreatment.findUnique({where:{id:"treatment"}})).groupKey!==`category:${categoryB}:2026-09`)throw new Error("Planning group key was not migrated.");
    if((await db.fuelExpenseSettings.findUnique({where:{id:"fuel-settings"}})).defaultCategoryId!==categoryB)throw new Error("Fuel category was not migrated.");
    if((await db.recurringTransaction.findUnique({where:{id:"series"}})).categoryId!==categoryB)throw new Error("Series category was not migrated.");
    let blocked=false;try{await db.expense.update({where:{id:"income"},data:{sharedWithFamily:true}});}catch{blocked=true;}
    if(!blocked)throw new Error("Income sharing constraint missing.");
    await db.expense.updateMany({where:{kind:"EXPENSE"},data:{sharedWithFamily:true}});
    const term=await db.familyFinanceCategory.create({data:{id:"shared-food",familyId:"family",name:"Lebensmittel",monthlyBudgetCents:20000}});
    for(const e of expenses.filter(e=>e.kind==="EXPENSE"))await db.familyCategoryMapping.create({data:{familyId:"family",userId:e.ownerUserId,personalId:e.categoryId,targetId:term.id}});
    await db.expense.create({data:{id:"private",familyId:"family",ownerUserId:"b",kind:"EXPENSE",amountCents:98765,date:new Date("2026-09-03"),description:"PRIVAT-NICHT-TEILEN"}});
    await db.expense.create({data:{id:"outsider-expense",familyId:"other",ownerUserId:"outsider",kind:"EXPENSE",amountCents:98765,date:new Date("2026-09-03"),description:"FREMDE-FAMILIE",sharedWithFamily:true}});
    console.log("PASS: legacy privacy, category ownership, budgets, forecast flags, task categories and income constraint.");
  }finally{await db.$disconnect();}
  console.log(`Isolated database ${testName} retained for browser tests; no application database was modified.`);
} catch(error) {console.error(error.message);process.exitCode=1;}
