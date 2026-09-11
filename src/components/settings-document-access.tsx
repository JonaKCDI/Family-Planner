"use client";

import { useState } from "react";

export function SettingsDocumentAccess({ members }: { members: { id: string; name: string }[] }) {
  const [mode, setMode] = useState("FAMILY");
  return (
    <>
      <label>Zugriff
        <select name="accessMode" value={mode} onChange={(event) => setMode(event.target.value)}>
          <option value="FAMILY">Alle Familienmitglieder</option>
          <option value="ADMIN">Nur Admins</option>
          <option value="USERS">Ausgewählte Nutzer</option>
        </select>
      </label>
      {mode === "USERS" ? (
        <fieldset className="fieldset full-span document-user-access">
          <legend>Wer darf diese Dokumente öffnen?</legend>
          {members.map((member) => (
            <label className="checkbox-field" key={member.id}>
              <input name="userId" type="checkbox" value={member.id} />{member.name}
            </label>
          ))}
        </fieldset>
      ) : null}
    </>
  );
}
