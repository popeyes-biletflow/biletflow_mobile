import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Badge, Button, ConfirmDialog, Field, LinkButton, Notice } from "../components.js";
import { useAuth } from "../auth.js";
import { useI18n } from "../i18n.js";
import { ACTIVATION_FEE_KZT, CHECKLIST_KEYS, fromLocalInput, isLocalInput, toLocalInput } from "../models.js";
import { Checkbox, DateTimeField, Muted, OptionCard, TextArea } from "../ui.js";
import { colors } from "../theme.js";

const VISIBILITIES = ["public", "unlisted", "private"];

// ---------------- EventEditor ----------------
export function EventEditor({ event, onSaved }) {
  const { client } = useAuth();
  const { t } = useI18n();
  const [f, setF] = useState({});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    setF({
      title: event?.title ?? "", description: event?.description ?? "", category: event?.category ?? "",
      startsAt: toLocalInput(event?.starts_at ?? null), endsAt: toLocalInput(event?.ends_at ?? null),
      venueName: event?.venue_name ?? "", venueAddress: event?.venue_address ?? "", imageUrl: event?.image_url ?? "",
      visibility: event?.visibility ?? "public", capacity: event?.capacity ? String(event.capacity) : "",
      regOpens: toLocalInput(event?.registration_opens_at ?? null), regCloses: toLocalInput(event?.registration_closes_at ?? null)
    });
  }, [event]);

  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
  const cancelled = event?.status === "cancelled";
  const disabled = cancelled || busy;

  function validate() {
    const errors = [];
    if (!f.title?.trim()) errors.push(t("editor.errors.title"));
    if (!f.startsAt) errors.push(t("editor.errors.startsAt"));
    if (f.endsAt && f.startsAt && f.endsAt <= f.startsAt) errors.push(t("editor.errors.endsAt"));
    if (f.regOpens && f.regCloses && f.regCloses <= f.regOpens) errors.push(t("editor.errors.registration"));
    if (f.capacity && Number(f.capacity) < 1) errors.push(t("editor.errors.capacity"));
    return errors;
  }

  async function save() {
    const errors = validate();
    if (errors.length) { setNotice({ tone: "error", text: t("editor.fixErrors"), items: errors }); return; }
    const body = {
      title: f.title.trim(), description: f.description || null, category: f.category || null,
      starts_at: fromLocalInput(f.startsAt), ends_at: fromLocalInput(f.endsAt), timezone: "Asia/Almaty",
      venue_name: f.venueName || null, venue_address: f.venueAddress || null, image_url: f.imageUrl || null,
      visibility: f.visibility, capacity: f.capacity ? Number(f.capacity) : null,
      registration_opens_at: fromLocalInput(f.regOpens), registration_closes_at: fromLocalInput(f.regCloses)
    };
    setBusy(true);
    setNotice(null);
    try {
      const saved = event ? await client.updateEvent(event.id, body) : await client.createEvent(body);
      setNotice({ tone: "success", text: event ? t("editor.saved") : t("editor.created") });
      onSaved(saved, !event);
    } catch (e) {
      setNotice({ tone: "error", text: t("editor.saveFailed", { reason: e.message }) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={st.form}>
      {notice ? <Notice tone={notice.tone} items={notice.items} onClose={() => setNotice(null)}>{notice.text}</Notice> : null}
      {cancelled ? <Notice tone="info">{t("editor.cancelledReadOnly")}</Notice> : null}
      <Field label={`${t("editor.title")} *`} value={f.title} onChangeText={set("title")} editable={!disabled} />
      <DateTimeField label={`${t("editor.startsAt")} *`} value={f.startsAt} onChange={set("startsAt")} disabled={disabled} />
      <DateTimeField label={t("editor.endsAt")} value={f.endsAt} onChange={set("endsAt")} disabled={disabled} />
      <Field label={`${t("editor.venueName")} *`} value={f.venueName} onChangeText={set("venueName")} editable={!disabled} />
      <Field label={t("editor.venueAddress")} value={f.venueAddress} onChangeText={set("venueAddress")} editable={!disabled} />
      <Field label={t("editor.category")} value={f.category} onChangeText={set("category")} editable={!disabled} />
      <Field label={t("editor.imageUrl")} value={f.imageUrl} onChangeText={set("imageUrl")} editable={!disabled} autoCapitalize="none" keyboardType="url" />
      <TextArea label={t("editor.description")} value={f.description} onChangeText={set("description")} rows={3} editable={!disabled} />

      <View style={st.fieldset}>
        <Text style={st.legend}>{t("editor.accessTitle")}</Text>
        <Text style={st.label}>{t("editor.visibility")}</Text>
        {VISIBILITIES.map((v) => (
          <OptionCard key={v} selected={f.visibility === v} disabled={disabled} onPress={() => set("visibility")(v)}
            title={t(`visibility.${v}`)} subtitle={t(`visibility.${v}Hint`)} />
        ))}
        <DateTimeField label={t("editor.registrationOpens")} value={f.regOpens} onChange={set("regOpens")} disabled={disabled} />
        <DateTimeField label={t("editor.registrationCloses")} value={f.regCloses} onChange={set("regCloses")} disabled={disabled} />
        <View>
          <Field label={t("editor.capacity")} value={f.capacity} onChangeText={set("capacity")} keyboardType="number-pad" placeholder="∞" editable={!disabled} />
          <Muted small style={st.hint}>{t("editor.capacityHint")}</Muted>
        </View>
        <Muted small>{t("editor.timezoneHint")}</Muted>
      </View>

      {!cancelled ? <Button label={busy ? t("common.saving") : event ? t("editor.save") : t("editor.createDraft")} loading={busy} onPress={save} /> : null}
    </View>
  );
}

// ---------------- TicketTypeManager ----------------
const emptyForm = { name: "", description: "", free: true, price: "", quantity: "", saleStarts: "", saleEnds: "", maxPerOrder: "1" };
const toForm = (tt) => ({
  name: tt.name ?? "", description: tt.description ?? "", free: !(tt.price && tt.price > 0),
  price: tt.price && tt.price > 0 ? String(tt.price) : "", quantity: tt.quantity === null ? "" : String(tt.quantity),
  saleStarts: toLocalInput(tt.sale_starts_at).replace("T", " "), saleEnds: toLocalInput(tt.sale_ends_at).replace("T", " "),
  maxPerOrder: tt.max_per_order ? String(tt.max_per_order) : ""
});

function isValidSaleDate(value) {
  if (!isLocalInput(value)) return false;
  const iso = fromLocalInput(value);
  return Number.isFinite(Date.parse(iso)) && toLocalInput(iso) === value;
}

export function TicketTypeManager({ eventId, types, readOnly, paidSalesActive, onChange }) {
  const { client } = useAuth();
  const { t, formatDate, formatKZT } = useI18n();
  const [editing, setEditing] = useState(types.length === 0 ? "new" : null);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const set = (k) => (v) => setForm((x) => ({ ...x, [k]: v }));

  function validate(saleStarts, saleEnds) {
    const errors = [];
    if (!form.name.trim()) errors.push(t("ticketTypes.errors.name"));
    if (!form.free && !(Number(form.price) > 0)) errors.push(t("ticketTypes.errors.price"));
    if (form.quantity && Number(form.quantity) < 0) errors.push(t("ticketTypes.errors.quantity"));
    if (editing && editing !== "new" && form.quantity && Number(form.quantity) < editing.sold) errors.push(t("ticketTypes.errors.belowSold", { sold: editing.sold }));
    if (form.maxPerOrder && Number(form.maxPerOrder) < 1) errors.push(t("ticketTypes.errors.maxPerOrder"));
    const datesRequired = editing === "new";
    const invalidStart = (datesRequired || saleStarts) && !isValidSaleDate(saleStarts);
    const invalidEnd = (datesRequired || saleEnds) && !isValidSaleDate(saleEnds);
    if (invalidStart) errors.push(t("saleDates.invalid", { field: t("ticketTypes.saleStarts") }));
    if (invalidEnd) errors.push(t("saleDates.invalid", { field: t("ticketTypes.saleEnds") }));
    if (!invalidStart && !invalidEnd && saleStarts && saleEnds && saleEnds <= saleStarts) {
      errors.push(t("ticketTypes.errors.saleWindow"));
    }
    return errors;
  }

  async function reload(text) {
    onChange(await client.ticketTypes(eventId));
    setNotice({ tone: "success", text });
  }

  async function submit() {
    const saleStarts = form.saleStarts.trim().replace(" ", "T");
    const saleEnds = form.saleEnds.trim().replace(" ", "T");
    const errors = validate(saleStarts, saleEnds);
    if (errors.length) { setNotice({ tone: "error", text: t("editor.fixErrors"), items: errors }); return; }
    const body = {
      name: form.name.trim(), description: form.description.trim() || null,
      price: form.free ? 0 : Math.round(Number(form.price)), quantity: form.quantity ? Number(form.quantity) : null,
      sale_starts_at: fromLocalInput(saleStarts), sale_ends_at: fromLocalInput(saleEnds),
      max_per_order: form.maxPerOrder ? Number(form.maxPerOrder) : null
    };
    setBusy(true);
    try {
      if (editing === "new") { await client.createTicketType(eventId, body); await reload(t("ticketTypes.created", { name: body.name })); }
      else { await client.updateTicketType(editing.id, body); await reload(t("ticketTypes.updated", { name: body.name })); }
      setEditing(null);
    } catch (e) {
      setNotice({ tone: "error", text: t("ticketTypes.saveFailed", { reason: e.message }) });
    } finally {
      setBusy(false);
    }
  }

  async function toggleHidden(tt) {
    setBusy(true);
    try {
      await client.updateTicketType(tt.id, { is_hidden: !tt.is_hidden });
      await reload(tt.is_hidden ? t("ticketTypes.shown", { name: tt.name }) : t("ticketTypes.hidden", { name: tt.name }));
    } catch (e) {
      setNotice({ tone: "error", text: t("ticketTypes.saveFailed", { reason: e.message }) });
    } finally {
      setBusy(false);
    }
  }

  const saleWindow = (tt) => {
    if (!tt.sale_starts_at && !tt.sale_ends_at) return t("ticketTypes.alwaysOnSale");
    return [
      tt.sale_starts_at && t("ticketTypes.from", { date: formatDate(tt.sale_starts_at, "Asia/Almaty", "full") }),
      tt.sale_ends_at && t("ticketTypes.until", { date: formatDate(tt.sale_ends_at, "Asia/Almaty", "full") })
    ].filter(Boolean).join(" · ");
  };

  return (
    <View style={st.form}>
      {notice ? <Notice tone={notice.tone} items={notice.items} onClose={() => setNotice(null)}>{notice.text}</Notice> : null}
      {types.length === 0 && !editing ? <Muted>{t("ticketTypes.empty")}</Muted> : null}

      {types.map((tt) => {
        const paid = (tt.price ?? 0) > 0;
        return (
          <View key={tt.id} style={[st.tt, tt.is_hidden && st.ttHidden]}>
            <View style={st.ttHead}>
              <Text style={st.ttName}>{tt.name}</Text>
              <Text style={st.ttPrice}>{paid ? formatKZT(tt.price ?? 0) : t("common.free")}</Text>
            </View>
            <View style={st.badges}>
              <Badge tone={paid ? "warning" : "success"} label={paid ? t("ticketTypes.paid") : t("ticketTypes.free")} />
              {tt.is_hidden ? <Badge label={t("ticketTypes.hiddenBadge")} /> : null}
              {paid && !paidSalesActive ? <Badge tone="error" label={t("ticketTypes.awaitingActivation")} /> : null}
            </View>
            {tt.description ? <Muted>{tt.description}</Muted> : null}
            <Muted small>
              {t("ticketTypes.soldOf", { sold: tt.sold, total: tt.quantity ?? "∞" })} · {t("ticketTypes.maxPerOrderShort", { count: tt.max_per_order ?? 1 })} · {saleWindow(tt)}
            </Muted>
            {!readOnly ? (
              <View style={st.row}>
                <LinkButton label={t("common.edit")} disabled={busy} onPress={() => { setForm(toForm(tt)); setEditing(tt); setNotice(null); }} />
                <LinkButton label={tt.is_hidden ? t("ticketTypes.unhide") : t("ticketTypes.hide")} disabled={busy} onPress={() => toggleHidden(tt)} />
              </View>
            ) : null}
          </View>
        );
      })}

      {!readOnly && !editing ? (
        <View style={st.row}>
          <Button small variant="outline" label={`+ ${t("ticketTypes.addFree")}`} onPress={() => { setForm({ ...emptyForm, free: true }); setEditing("new"); }} />
          <Button small variant="outline" label={`+ ${t("ticketTypes.addPaid")}`} onPress={() => { setForm({ ...emptyForm, free: false }); setEditing("new"); }} />
        </View>
      ) : null}

      {!readOnly && editing ? (
        <View style={st.editBox}>
          <Text style={st.legend}>{editing === "new" ? t("ticketTypes.newTitle") : t("ticketTypes.editTitle", { name: editing.name })}</Text>
          <Field label={`${t("ticketTypes.name")} *`} value={form.name} onChangeText={set("name")} editable={!busy} />
          <Text style={st.label}>{t("ticketTypes.pricing")}</Text>
          <View style={st.row}>
            <View style={st.flex}><OptionCard tone="emerald" selected={form.free} onPress={() => set("free")(true)} title={t("ticketTypes.free")} /></View>
            <View style={st.flex}><OptionCard tone="amber" selected={!form.free} onPress={() => set("free")(false)} title={t("ticketTypes.paid")} /></View>
          </View>
          <TextArea label={t("ticketTypes.description")} value={form.description} onChangeText={set("description")} rows={2} />
          {!form.free ? (
            <View>
              <Field label={`${t("ticketTypes.price")} *`} value={form.price} onChangeText={set("price")} keyboardType="number-pad" />
              {Number(form.price) > 0 ? <Muted small style={st.hint}>{formatKZT(Number(form.price))}</Muted> : null}
            </View>
          ) : null}
          <Field label={t("ticketTypes.quantity")} value={form.quantity} onChangeText={set("quantity")} keyboardType="number-pad" placeholder="∞" />
          <Field label={t("ticketTypes.maxPerOrder")} value={form.maxPerOrder} onChangeText={set("maxPerOrder")} keyboardType="number-pad" />
          <Field label={t("ticketTypes.saleStarts") + (editing === "new" ? " *" : "")}
            value={form.saleStarts} onChangeText={set("saleStarts")} placeholder={t("picker.formatHint")}
            autoCorrect={false} autoCapitalize="none" editable={!busy} />
          <Field label={t("ticketTypes.saleEnds") + (editing === "new" ? " *" : "")}
            value={form.saleEnds} onChangeText={set("saleEnds")} placeholder={t("picker.formatHint")}
            autoCorrect={false} autoCapitalize="none" editable={!busy} />
          <Muted small>{t("editor.timezoneHint")}</Muted>
          {!form.free && !paidSalesActive ? <Text style={st.amber}>{t("ticketTypes.paidHint")}</Text> : null}
          <View style={st.row}>
            <Button small label={busy ? t("common.saving") : editing === "new" ? t("ticketTypes.create") : t("common.save")} loading={busy} onPress={submit} />
            <Button small variant="outline" label={t("common.cancel")} onPress={() => { setEditing(null); setNotice(null); }} />
          </View>
        </View>
      ) : null}
    </View>
  );
}

// ---------------- PaidSalesActivation ----------------
export function PaidSalesActivation({ event, types, onActivated, onGoToTickets }) {
  const { client } = useAuth();
  const { t, formatKZT } = useI18n();
  const [profile, setProfile] = useState(null);
  const [payout, setPayout] = useState("");
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    client.getProfile().then((p) => { setProfile(p); setPayout(p.payout_info ?? ""); })
      .catch((e) => setNotice({ tone: "error", text: t("activation.profileFailed", { reason: e.message }) }));
  }, [client, t]);

  const active = event.paid_sales_status === "ACTIVE";
  const suspended = event.paid_sales_status === "SUSPENDED";
  const local = {
    at_least_one_paid_ticket_type: types.some((tt) => (tt.price ?? 0) > 0) ? "passed" : "missing",
    valid_payout_account: profile?.payout_info?.trim() ? "passed" : "missing",
    identity_verified: "passed",
    activation_fee_paid: active ? "passed" : "pending",
    paid_event_terms_accepted: active || terms ? "passed" : "missing"
  };
  const state = (k) => (active ? "passed" : local[k]);
  const missing = CHECKLIST_KEYS.filter((k) => state(k) === "missing");
  const fee = formatKZT(ACTIVATION_FEE_KZT);

  async function savePayout() {
    if (!payout.trim()) { setNotice({ tone: "error", text: t("activation.payoutRequired") }); return; }
    setBusy(true);
    try { setProfile(await client.savePayout(payout.trim())); setNotice({ tone: "success", text: t("activation.payoutSaved") }); }
    catch (e) { setNotice({ tone: "error", text: t("activation.payoutFailed", { reason: e.message }) }); }
    finally { setBusy(false); }
  }

  async function activate() {
    setBusy(true);
    setNotice(null);
    try {
      const res = await client.activatePaidSales(event.id, terms);
      setNotice({ tone: "success", text: res.status === "already_active" ? t("activation.alreadyActive") : t("activation.success", { fee: formatKZT(res.activation_fee_kzt ?? ACTIVATION_FEE_KZT) }) });
      onActivated();
    } catch (e) {
      const checklist = e.body && typeof e.body === "object" ? e.body.checklist : null;
      if (checklist) {
        const failed = CHECKLIST_KEYS.filter((k) => checklist[k] && !checklist[k].passed);
        setNotice({ tone: "error", text: t("activation.failed"), items: failed.map((k) => t(`activation.missing.${k}`)) });
      } else {
        setNotice({ tone: "error", text: t("activation.requestFailed", { reason: e.message }) });
      }
    } finally {
      setBusy(false);
    }
  }

  const icon = { passed: "✓", missing: "✕", pending: "•" };
  const iconStyle = { passed: st.iconOk, missing: st.iconBad, pending: st.iconPending };

  return (
    <View style={st.form}>
      <Notice tone={active ? "success" : suspended ? "error" : "warning"}
        title={active ? t("activation.statusActive") : suspended ? t("activation.statusSuspended") : t("activation.statusInactive")}>
        {active ? t("activation.activeHint") : suspended ? t("activation.suspendedHint") : t("activation.inactiveHint")}
      </Notice>
      {notice ? <Notice tone={notice.tone} items={notice.items} onClose={() => setNotice(null)}>{notice.text}</Notice> : null}

      {CHECKLIST_KEYS.map((key) => {
        const s = state(key);
        return (
          <View key={key} style={st.check}>
            <Text style={[st.icon, iconStyle[s]]}>{icon[s]}</Text>
            <View style={st.flex}>
              <Text style={st.checkTitle}>{t(`activation.items.${key}`)}</Text>
              <Text style={[st.checkText, s === "missing" && st.red]}>{s === "missing" ? t(`activation.missing.${key}`) : t(`activation.ok.${key}`, { fee })}</Text>
              {key === "at_least_one_paid_ticket_type" && s === "missing" ? <LinkButton label={t("activation.addPaidType")} onPress={onGoToTickets} /> : null}
              {key === "valid_payout_account" && !active ? (
                <View style={st.payout}>
                  <Field value={payout} onChangeText={setPayout} placeholder="KZ00 0000 0000 0000 0000" accessibilityLabel={t("activation.payoutLabel")} autoCapitalize="characters" />
                  <Button small label={t("activation.savePayout")} disabled={busy || payout.trim() === (profile?.payout_info ?? "")} onPress={savePayout} />
                </View>
              ) : null}
              {key === "paid_event_terms_accepted" && !active ? (
                <View style={st.top8}><Checkbox checked={terms} onChange={setTerms} label={t("activation.termsText", { fee })} /></View>
              ) : null}
            </View>
          </View>
        );
      })}

      {!active && !suspended ? (
        <View style={st.form}>
          {missing.length > 0 ? <Text style={st.red}>{t("activation.stillMissing", { count: missing.length })}</Text> : null}
          <Button label={busy ? t("activation.activating") : t("activation.activate", { fee })} loading={busy} onPress={activate} />
          <Muted small>{t("activation.simulatedNote")}</Muted>
        </View>
      ) : null}
    </View>
  );
}

// ---------------- Staff assignment (FS-04 API; powers the mobile scanner) ----------------
export function StaffManager({ eventId, readOnly }) {
  const { client } = useAuth();
  const { t, formatStamp } = useI18n();
  const [staff, setStaff] = useState([]);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [remove, setRemove] = useState(null);

  const load = useCallback(() => {
    client.listStaff(eventId).then(setStaff).catch((e) => setNotice({ tone: "error", text: e.message }));
  }, [client, eventId]);
  useEffect(() => { load(); }, [load]);

  async function add() {
    if (!email.trim()) { setNotice({ tone: "error", text: t("staff.emailRequired") }); return; }
    setBusy(true);
    try { await client.assignStaff(eventId, email.trim()); setEmail(""); setNotice({ tone: "success", text: t("staff.added") }); load(); }
    catch (e) { setNotice({ tone: "error", text: t("staff.failed", { reason: e.status === 404 ? t("staff.notFound") : e.message }) }); }
    finally { setBusy(false); }
  }

  async function doRemove(member) {
    setBusy(true);
    try { await client.removeStaff(eventId, member.user_id); setNotice({ tone: "success", text: t("staff.removed") }); load(); }
    catch (e) { setNotice({ tone: "error", text: t("staff.failed", { reason: e.message }) }); }
    finally { setBusy(false); }
  }

  return (
    <View style={st.form}>
      <Muted>{t("staff.hint")}</Muted>
      {notice ? <Notice tone={notice.tone} onClose={() => setNotice(null)}>{notice.text}</Notice> : null}
      {staff.length === 0 ? <Muted>{t("staff.empty")}</Muted> : null}
      {staff.map((m) => (
        <View key={m.user_id} style={st.staffRow}>
          <View style={st.flex}>
            <Text style={st.ttName}>{m.full_name || m.email || m.user_id}</Text>
            {m.email ? <Muted small>{m.email}</Muted> : null}
            {m.assigned_at ? <Muted small>{formatStamp(m.assigned_at)}</Muted> : null}
          </View>
          {!readOnly ? <Button small variant="danger" label={t("staff.remove")} disabled={busy} onPress={() => setRemove(m)} /> : null}
        </View>
      ))}
      {!readOnly ? (
        <View style={st.form}>
          <Field label={t("staff.email")} value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" />
          <Button small label={t("staff.add")} loading={busy} onPress={add} />
        </View>
      ) : null}
      <ConfirmDialog visible={!!remove} danger title={t("staff.remove")} body={remove ? t("staff.confirmRemove", { name: remove.full_name || remove.email || "" }) : ""}
        confirmLabel={t("staff.remove")} cancelLabel={t("common.cancel")}
        onCancel={() => setRemove(null)} onConfirm={() => { const m = remove; setRemove(null); doRemove(m); }} />
    </View>
  );
}

const st = StyleSheet.create({
  flex: { flex: 1 },
  form: { gap: 12 },
  fieldset: { gap: 10, borderWidth: 1, borderColor: colors.gray200, borderRadius: 8, padding: 12 },
  legend: { fontSize: 14, fontWeight: "600", color: colors.gray900 },
  label: { fontSize: 14, color: colors.gray700 },
  hint: { marginTop: 4 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 10, alignItems: "center" },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tt: { borderWidth: 1, borderColor: colors.gray200, borderRadius: 8, padding: 12, gap: 6 },
  ttHidden: { backgroundColor: colors.gray50 },
  ttHead: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  ttName: { fontSize: 15, fontWeight: "600", color: colors.gray900, flexShrink: 1 },
  ttPrice: { fontSize: 15, fontWeight: "700", color: colors.gray900 },
  editBox: { gap: 12, borderWidth: 1, borderColor: colors.blue100, backgroundColor: "#f5f9ff", borderRadius: 8, padding: 12 },
  amber: { fontSize: 12, color: colors.amber800 },
  check: { flexDirection: "row", gap: 10, borderBottomWidth: 1, borderBottomColor: colors.gray100, paddingBottom: 12 },
  icon: { width: 24, height: 24, borderRadius: 12, textAlign: "center", lineHeight: 24, fontWeight: "700", overflow: "hidden" },
  iconOk: { backgroundColor: colors.emerald100, color: colors.emerald700 },
  iconBad: { backgroundColor: colors.red100, color: colors.red700 },
  iconPending: { backgroundColor: colors.gray100, color: colors.gray500 },
  checkTitle: { fontSize: 15, fontWeight: "500", color: colors.gray900 },
  checkText: { fontSize: 13, color: colors.gray500, marginTop: 2 },
  red: { fontSize: 13, color: colors.red700 },
  payout: { gap: 8, marginTop: 8 },
  top8: { marginTop: 8 },
  staffRow: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: colors.gray200, borderRadius: 8, padding: 12 }
});
