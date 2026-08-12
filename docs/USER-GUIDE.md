# User guide

How to use Science LMS day to day. Sign in at the home page with your staff email and password. Sessions end automatically after **5 minutes** of inactivity.

---

## Common UI

- **Sidebar** (desktop) / **menu button** (mobile) — navigate modules you are allowed to see  
- **Bell** — unread notifications (pending approvals, status changes)  
- **Theme toggle** — light / dark  
- **Sign out** — ends the server session  

---

## Teacher

### Create a practical requisition

1. Open **Requisitions** → **New requisition** (or Dashboard shortcut).  
2. Fill in subject, topic, form, student count, objectives, safety notes.  
3. Choose **laboratory**, **date**, and **timetable period**.  
4. Add apparatus / chemical / reagent **line items** and quantities.  
5. Review any **conflict alerts** (lab already booked or stock shortage).  
6. **Save draft** or **Submit for verification**.

Submitted requests appear under **Awaiting review**. You only see **your own** requisitions.

### After approval

- Watch notifications for approve / reject / prepare updates.  
- Open the requisition detail page for status, notes, and session outcome.

### Tips

- Pick a valid period from the school timetable — do not leave the slot empty.  
- If submit fails with “already booked”, choose another lab or period.  
- Keep `npm run dev` / the school server running so admin sees your submission on the shared database.

---

## Lab attendant

### Review queue

1. Open **Requisitions** → **Awaiting review**.  
2. Open a submitted request.  
3. Check conflicts and line items.  
4. Add an optional note, then **Approve & reserve stock** or **Reject**.

Approval reserves stock for that booking.

### Prepare and run the session

1. When status is **approved**, mark **Lab prepared**.  
2. At lesson time, **Start session** (`in_progress`).  
3. After the practical, **Complete session**:
   - Record consumable usage  
   - Log breakages / returnable damage if needed  
4. Or mark **not done** with a reason (power outage, missing reagents, etc.).

### Inventory & labs

- **Store & Inventory** — adjust stock, receive deliveries, edit items.  
- **Laboratories** — view rooms and capacity (edit if you have manage rights).  
- **Lab Schedule** — see the weekly timetable; reschedule when permitted.

---

## Administrator

Everything attendants can do, plus:

### Users

**Users** → add staff, assign roles, set passwords, activate / deactivate accounts.

### Roles & permissions

**Roles & Permissions** → create custom roles or adjust permissions for non-system roles. Built-in Admin / Attendant / Teacher roles are protected from deletion.

### Settings

**Settings** (system tabs) → school name/tagline, periods, subjects, forms, not-done reasons.  
All signed-in users can update their **own profile** (name, photo, password).

### Audit

**Audit Log** — review recent privileged actions.

### System reset

Footer **Reset to clean system** (admin only) restores seed inventory and demo accounts. **Destroys live data** — use only on training installs.

---

## Typical school week scenario

1. Teacher submits Friday practical for Lab 2, Period 3–4, with apparatus list.  
2. Attendant/admin sees notification → opens queue → approves.  
3. Attendant prepares trays Thursday afternoon → marks prepared.  
4. Friday: start session → complete with consumable deduction.  
5. Teacher sees “completed” on their requisition list.

---

## Troubleshooting

| Symptom | What to try |
|---------|-------------|
| Admin does not see teacher’s submit | Ensure one shared server is running; both users signed into that host; hard-refresh |
| “Authentication required” / sudden logout | Session expired or idle timeout; sign in again |
| Styles flash / slow first menu open | Hard-refresh once after upgrade; first visit compiles routes in dev |
| Cannot approve | Account needs `requisitions.approve`; check role |
| Login rate-limited | Wait ~1–5 minutes after many failed attempts |
