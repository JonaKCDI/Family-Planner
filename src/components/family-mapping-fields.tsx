"use client";

import { useState } from "react";
import { saveFamilyMapping } from "@/lib/family-finance-actions";

type Options = {categories:{id:string;name:string;archivedAt:string|null}[];labels:{id:string;name:string;archivedAt:string|null}[];categoryMappings:{personalId:string;targetId:string}[];labelMappings:{personalId:string;targetId:string}[]};

export function FamilyMappingFields() {
  const [options,setOptions] = useState<Options>();
  const [category,setCategory] = useState("");
  const [label,setLabel] = useState("");
  const [categoryTarget,setCategoryTarget] = useState("");
  const [labelTarget,setLabelTarget] = useState("");
  const [message,setMessage] = useState("");
  const [busy,setBusy] = useState(false);
  return <div className="family-mapping-fields"><button type="button" className="button secondary" disabled={busy} onClick={async e=>{
    const form = e.currentTarget.closest("form");
    if (!form) return;
    const data = new FormData(form);
    const categoryId=String(data.get("categoryId")??""),labelId=String(data.get("labelId")??"");
    setBusy(true);setMessage("");
    try {
      const response=await fetch("/api/expenses/family-mappings",{cache:"no-store"});
      if (!response.ok) throw new Error("Zuordnungen konnten nicht geladen werden.");
      const result:Options=await response.json();setOptions(result);setCategory(categoryId);setLabel(labelId);
      setCategoryTarget(result.categoryMappings.find(m=>m.personalId===categoryId)?.targetId??"");
      setLabelTarget(result.labelMappings.find(m=>m.personalId===labelId)?.targetId??"");
    } catch {setMessage("Zuordnungen konnten nicht geladen werden.");} finally {setBusy(false);}
  }}>Familienzuordnung</button>
  {options ? <><p className="muted">Für die aktuell gewählte persönliche Kategorie und das Label. Änderungen gelten auch für ältere geteilte Ausgaben.</p>
    {category ? <label>Familienkategorie<select value={categoryTarget} onChange={e=>setCategoryTarget(e.target.value)}><option value="">Nicht zugeordnet</option>{options.categories.map(c=><option value={c.id} key={c.id} disabled={Boolean(c.archivedAt) && c.id!==categoryTarget}>{c.name}{c.archivedAt ? " · Archiviert" : ""}</option>)}<option value="__copy">Persönlichen Begriff übernehmen</option></select></label>:null}
    {label ? <label>Familienlabel<select value={labelTarget} onChange={e=>setLabelTarget(e.target.value)}><option value="">Nicht zugeordnet</option>{options.labels.map(c=><option value={c.id} key={c.id} disabled={Boolean(c.archivedAt) && c.id!==labelTarget}>{c.name}{c.archivedAt ? " · Archiviert" : ""}</option>)}<option value="__copy">Persönlichen Begriff übernehmen</option></select></label>:null}
    {!category&&!label?<p>Zuerst eine persönliche Kategorie oder ein Label wählen.</p>:<button className="button secondary" type="button" disabled={busy} onClick={async()=>{
      setBusy(true);setMessage("");
      try {for (const [type,personalId,targetId] of [["category",category,categoryTarget],["label",label,labelTarget]]) if(personalId){const form=new FormData();form.set("type",type);form.set("personalId",personalId);form.set("targetId",targetId);await saveFamilyMapping(form);}setMessage("Zuordnung gespeichert.");}catch{setMessage("Zuordnung konnte nicht gespeichert werden.");}finally{setBusy(false);}
    }}>Zuordnung speichern</button>}
  </>:null}<span role="status">{message}</span></div>;
}
