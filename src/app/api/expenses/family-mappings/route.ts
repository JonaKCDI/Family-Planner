import { NextResponse } from "next/server";
import { requireFinanceMember } from "@/lib/family-finance";
import { db } from "@/lib/db";

export async function GET() {
  const {family,user} = await requireFinanceMember();
  const where = {familyId:family.id};
  const [categories,labels,categoryMappings,labelMappings] = await Promise.all([
    db.familyFinanceCategory.findMany({where,select:{id:true,name:true,archivedAt:true},orderBy:{name:"asc"}}),
    db.familyFinanceLabel.findMany({where,select:{id:true,name:true,archivedAt:true},orderBy:{name:"asc"}}),
    db.familyCategoryMapping.findMany({where:{...where,userId:user.id},select:{personalId:true,targetId:true}}),
    db.familyLabelMapping.findMany({where:{...where,userId:user.id},select:{personalId:true,targetId:true}})
  ]);
  return NextResponse.json({categories,labels,categoryMappings,labelMappings});
}
