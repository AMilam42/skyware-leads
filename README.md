# Skyware Leads: iPad / iPhone version

A booth sign-up form that runs entirely on the iPad or iPhone. You don't need a laptop, and once it's installed it works with no wifi or cell signal.

## Installing it on an iPad (once, with internet)

1. In **Safari**, open the app's web address (see "Hosting" below).
2. Tap **Share** → **Add to Home Screen** → **Add**. A Skyware Leads icon appears.
3. **Always open it from that icon.** Leads are stored inside the home-screen app, separately from Safari. If you open the address in Safari instead, you won't see the leads you saved in the app.

To keep visitors in the app, turn on **Guided Access** (Settings → Accessibility → Guided Access), open the app, and triple-click the side or top button.

## At the booth

- Visitors fill in Name, Property Name, Phone Number and Email, then tap **Let's Talk**.
- Bad emails and phone numbers are caught with a clear message.
- A thank-you screen shows and the form clears after 8 seconds.

## Staff screen

Tap the small **Staff** link at the bottom of the form and sign in with a staff username and password. Each lead records who was signed in (the **Collected By** column).

**Adding or changing a login:** run `node make-login.js <username> <password>` in this folder, paste the line it prints into `staffLogins` in `config.js` (delete the temporary `staff` login), bump `VERSION` in `sw.js`, then run `vercel deploy --prod`. Passwords are stored as fingerprints and checked on the iPad. That keeps visitors out, but it isn't strong security, so don't reuse an important password.

From the Staff screen you can:

- **Event name:** type the show's name at the start of each show and tap **Save event name**. Every new lead is tagged with it, and the iPad remembers it.
- **Brand for this show:** tap the **Payments** or **RV Solutions** tile. This switches the logo, colors and wording on that iPad. The RV look has no "Powered by 1Step" line and uses the company-wide Skyware contact details in the footer. The home-screen icon stays the hotel logo.
- **Export Excel:** creates `Skyware Leads - <event> - <date>.xlsx` and opens the share sheet. Choose **Save to Files** → Dropbox → `1STEP Team Folder/Sales/Conferences/<show>`, or Mail or AirDrop. The screen shows when you last exported and how many leads are new since then.
- **Clear leads from this device:** use this only after exporting at the end of a show. You have to type CLEAR, and it warns you if anything hasn't been exported.

**Export at the end of every day.** The leads live only on that iPad until you export them.

## The Excel file

Columns: Lead ID, Submission Timestamp, Event Name, Name, Property Name, Phone Number, Email, Possible Duplicate, Follow Up Status ("New"), Assigned To, Notes. The header row is frozen and filters are on. Possible duplicates (the same email or property name as an earlier lead on that device) are still saved, shaded orange, with a note saying which lead they match.

Each iPad has its own list, so two iPads at one show produce two files. Copy the rows into one sheet afterwards; the Lead IDs won't clash.

## Changing the form

- **Fields:** edit `config.js` (the `fields` list). Use type `text`, `email` or `phone`.
- **Colors and fonts:** `brand.css`.
- After any change, edit `sw.js` and bump `VERSION` (e.g. `v2` → `v3`), then upload the files again. The iPads pick up the update the next time the app is opened with internet.

## Hosting

**Live address: https://skyware-leads.vercel.app**

It's hosted on Vercel (team *1-step*, project *skyware-leads*). To publish changes, run `vercel deploy --prod` in this folder. The code is also kept in the GitHub repo `AMilam42/skyware-leads`. The app contains no lead data; leads never leave the iPad except when you export them.

## Files

`index.html` (page), `app.js` (form, storage, staff screen), `xlsx.js` (builds the Excel file on the device), `config.js` (settings), `sw.js` (offline support), `manifest.webmanifest` and `icon-*.png` (home-screen icon), `brand.css` and `app.css` (styling), `logo.png`.
