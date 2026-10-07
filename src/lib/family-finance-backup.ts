import { db } from "./db";
import type { ExpenseExportRow, ExpenseFormatRow } from "./expense-formats";

export async function enrichPersonalExport(rows: ExpenseExportRow[], familyId: string, userId: string) {
  const [expenses, categories, labels] = await Promise.all([
    db.expense.findMany({where:{familyId,ownerUserId:userId,id:{in:rows.map(r=>r.id)}},select:{id:true,categoryId:true,labelId:true}}),
    db.familyCategoryMapping.findMany({where:{familyId,userId},include:{target:true}}),
    db.familyLabelMapping.findMany({where:{familyId,userId},include:{target:true}})
  ]);
  const byId = new Map(expenses.map(e=>[e.id,e]));
  return rows.map(row=>({ ...row,
    familyCategoryName:categories.find(m=>m.personalId===byId.get(row.id)?.categoryId)?.target.name??"",
    familyLabelName:labels.find(m=>m.personalId===byId.get(row.id)?.labelId)?.target.name??""
  }));
}

export async function restorePersonalMappings(row: ExpenseFormatRow, familyId: string, userId: string, categoryId: string | null, labelId: string | null) {
  await db.$transaction(async tx=>{
    if (row.familyCategoryName !== undefined && categoryId) {
      const name = row.familyCategoryName.trim();
      const where = {familyId,userId,personalId:categoryId};
      await tx.familyCategoryMapping.deleteMany({where});
      if (name) {
        const target = await tx.familyFinanceCategory.upsert({where:{familyId_name:{familyId,name}},create:{familyId,name},update:{}});
        await tx.familyCategoryMapping.create({data:{...where,targetId:target.id}});
      }
    }
    if (row.familyLabelName !== undefined && labelId) {
      const name = row.familyLabelName.trim();
      const where = {familyId,userId,personalId:labelId};
      await tx.familyLabelMapping.deleteMany({where});
      if (name) {
        const target = await tx.familyFinanceLabel.upsert({where:{familyId_name:{familyId,name}},create:{familyId,name},update:{}});
        await tx.familyLabelMapping.create({data:{...where,targetId:target.id}});
      }
    }
  });
}
