# komi — gemeinsam gut essen

Mobile-first App zum Planen von Mahlzeiten, Verwalten von Rezepten und Führen einer Einkaufsliste. Die Daten lassen sich mit Supabase zwischen angemeldeten Geräten synchronisieren.

## Voraussetzungen

- Node.js 22
- pnpm 11 (`npm install --global pnpm`)

## Lokal starten

```sh
pnpm install
pnpm dev
```

Produktions-Build lokal erzeugen:

```sh
pnpm run build
pnpm preview
```

## Supabase-Datenbank einrichten

1. Erstelle unter [supabase.com](https://supabase.com) ein Projekt und notiere dir die Projekt-URL sowie den **Publishable key**. Diese Informationen findest du in den Projekteinstellungen unter **API Keys**.
2. Öffne im Supabase-Projekt **SQL Editor → New query**. Kopiere den Inhalt aus [`supabase/setup.sql`](supabase/setup.sql) hinein und klicke **Run**. Damit entstehen die Tabelle für den gemeinsamen App-Stand, die Mitgliedschaftstabelle und Zugriffsschutz (RLS).
3. Lege in **Authentication → Users** die Konten für dich und die Mitnutzer an. Verwende für die App jeweils diese E-Mail-Adressen und Passwörter.
4. Kopiere bei jedem erstellten Konto die User-ID. Führe im SQL Editor Folgendes aus und ersetze die UUIDs:

   ```sql
   insert into public.app_members (user_id)
   values
     ('UUID-DES-ERSTEN-USERS'),
     ('UUID-DES-ZWEITEN-USERS')
   on conflict (user_id) do nothing;
   ```

   Damit dürfen nur diese ausdrücklich eingetragenen Nutzer den gemeinsamen Plan lesen und ändern. Erstelle keine offenen Registrierungen für diesen privaten Haushalt.

5. Öffne in Supabase **Authentication → URL Configuration**. Trage als Site URL die spätere Pages-Adresse ein, zum Beispiel `https://BENUTZER.github.io/REPOSITORY/`. Füge dieselbe URL unter **Redirect URLs** hinzu. Wenn du die lokale Vorschau verwendest, füge zusätzlich `http://localhost:5173/**` als Redirect URL hinzu.

Die App speichert den kompletten gemeinsamen App-Stand in einer JSONB-Datenbankzeile. Änderungen werden automatisch gespeichert und über Supabase Realtime an andere geöffnete Geräte übertragen. Es gibt weiterhin einen Browser-Cache als lokale Kopie. Supabase-URL und Publishable key sind Client-Konfiguration; **Service-Role-Keys dürfen niemals in diese App oder GitHub Pages**.

## GitHub Pages veröffentlichen

Das lokale Repository befindet sich im Projektordner und verwendet den Branch `main`. In GitHub Desktop muss als lokales Repository `/Users/alidabudde/Desktop/app 2.0` geöffnet sein. Der GitHub-Remote ist `https://github.com/ali200000000/home.git`. Den separaten Unterordner `einkauf/` nicht zum App-Repository hinzufügen.

Wenn GitHub Desktop die Änderungen im App-Ordner anzeigt, prüfe sie, committe die App-Dateien und klicke **Push origin**. Falls das Online-Repository noch nicht veröffentlicht wurde, nutze **Publish repository**, nenne es `home`, wähle das Konto `ali200000000` und lasse **Keep this code private** ausgeschaltet.

Danach:

1. Im GitHub-Repository öffne **Settings → Secrets and variables → Actions → Variables** und füge zwei Repository-Variablen hinzu:
   - `VITE_SUPABASE_URL` = Projekt-URL aus Supabase
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = Publishable key aus Supabase
2. Öffne **Settings → Pages** und wähle bei **Build and deployment → Source** die Option **GitHub Actions**.
3. Öffne **Actions**. Der Workflow **Deploy to GitHub Pages** baut und veröffentlicht die App bei jedem Push auf `main`.
4. Nach erfolgreichem Workflow findest du die Adresse unter **Settings → Pages**. Falls du eine Supabase-Redirect-URL vorab eingetragen hast, stelle sicher, dass sie genau mit dieser Adresse übereinstimmt.

Der Workflow ermittelt den Repository-Namen automatisch als Vite-Basispfad. Eine eigene Domain braucht als Basispfad `/`.

## Projektstruktur

- `src/App.tsx` — React-Oberfläche, Anmeldung, Daten laden und speichern
- `src/supabase.ts` — Supabase-Client
- `src/styles.css` — App-Stile
- `supabase/setup.sql` — Tabellen, Mitgliedschaft und RLS-Regeln
- `.github/workflows/deploy.yml` — GitHub-Pages-Build und Veröffentlichung

Ohne Supabase-Konfiguration startet die App weiterhin im lokalen Browser-Speichermodus. Für gemeinsame Speicherung müssen Supabase-Projekt, Mitgliedschaften und die beiden GitHub-Variablen eingerichtet sein.
